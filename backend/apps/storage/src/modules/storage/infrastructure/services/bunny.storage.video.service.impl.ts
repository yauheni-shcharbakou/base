import { NestStorage } from '@backend/proto';
import { StorageVideo } from '@modules/storage/domain/entities/storage.video.interface';
import {
  StorageVideoCreateData,
  StorageVideoList,
  StorageVideoService,
  StorageVideoTusUploadData,
} from '@modules/storage/domain/services/storage.video.service';
import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Either, left, right } from '@sweet-monads/either';
import { AxiosError, AxiosInstance } from 'axios';
import _ from 'lodash';
import moment from 'moment';
import { createHash } from 'node:crypto';
import { BunnyStorageConfig } from '../configs/bunny.storage.config';
import { VIDEO_HTTP_CLIENT } from '../constants/client.tokens';
import { BunnyUpdateBody, BunnyVideo, BunnyVideoList } from '../types/bunny.types';

@Injectable()
export class BunnyStorageVideoServiceImpl implements StorageVideoService {
  private readonly logger = new Logger(BunnyStorageVideoServiceImpl.name);
  private readonly streamConfig: BunnyStorageConfig['bunny']['stream'];

  constructor(
    private readonly configService: ConfigService<BunnyStorageConfig>,
    @Inject(VIDEO_HTTP_CLIENT) private readonly httpClient: AxiosInstance,
  ) {
    this.httpClient.interceptors.response.use(undefined, (axiosError: AxiosError) => {
      this.logger.error(
        'Bunny stream API error: ',
        JSON.stringify(
          {
            url: axiosError.config?.url,
            method: axiosError.config?.method,
            response: axiosError.response?.data,
          },
          null,
          2,
        ),
      );

      throw axiosError;
    });

    this.streamConfig = configService.getOrThrow('bunny.stream', { infer: true });
  }

  async createVideo(
    data: StorageVideoCreateData,
  ): Promise<Either<InternalServerErrorException, string>> {
    try {
      const response = await this.httpClient.post<BunnyVideo>('videos', { title: data.title });
      const id = response.data.guid;

      if (data.description) {
        await this.httpClient.post(`videos/${id}`, {
          metaTags: [
            {
              property: 'description',
              value: data.description,
            },
          ],
        });
      }

      return right(id);
    } catch (e) {
      return left(new InternalServerErrorException("Can't create video in Bunny Stream"));
    }
  }

  getTusUpload(
    providerId: string,
    data: StorageVideoTusUploadData,
  ): Either<Error, NestStorage.VideoTusUpload> {
    try {
      const { apiKey, libraryId, tus } = this.streamConfig;

      // Bunny compares the AuthorizationExpire header against the value that was signed, so the
      // string is built once and both signed and returned — never recomputed from a number.
      const expires = moment().add(tus.expiresInMinutes, 'minutes').unix().toString();
      const hashableBase = libraryId + apiKey + expires + providerId;
      const signature = createHash('sha256').update(hashableBase).digest('hex');

      return right({
        endpoint: tus.url,
        libraryId,
        videoId: providerId,
        signature,
        expires,
        filetype: data.mimeType,
        title: data.title,
      });
    } catch (error) {
      return left(error);
    }
  }

  async deleteVideo(providerId: string): Promise<Either<InternalServerErrorException, boolean>> {
    try {
      await this.httpClient.delete(`videos/${providerId}`);
      return right(true);
    } catch (e) {
      // Already gone is the outcome a delete wants. The purge consumer retries every failure, so
      // treating a 404 as one would burn every attempt on a video that no longer exists.
      if ((e as AxiosError)?.response?.status === 404) {
        return right(true);
      }

      return left(new InternalServerErrorException("Can't delete video from bunny stream"));
    }
  }

  async updateVideo(
    providerId: string,
    updateData: NestStorage.VideoUpdateSet,
  ): Promise<Either<Error, boolean>> {
    try {
      const body: BunnyUpdateBody = {};

      if (updateData.title) {
        body.title = updateData.title;
      }

      if (updateData.description) {
        body.metaTags = [
          {
            property: 'description',
            value: updateData.description,
          },
        ];
      }

      await this.httpClient.post(`videos/${providerId}`, body);
      return right(true);
    } catch (e) {
      return left(e);
    }
  }

  async getVideo(providerId: string): Promise<Either<Error, StorageVideo>> {
    try {
      const response = await this.httpClient.get<BunnyVideo>(`videos/${providerId}`);
      return right(this.toStorageVideo(response.data));
    } catch (e) {
      return left(e);
    }
  }

  async getList(page: number, limit: number): Promise<StorageVideoList> {
    try {
      const response = await this.httpClient.get<BunnyVideoList>(
        `videos?page=${page}&itemsPerPage=${limit}`,
      );

      return {
        total: response.data.totalItems,
        items: _.map(response.data.items, (item) => this.toStorageVideo(item)),
      };
    } catch (e) {
      return { total: 0, items: [] };
    }
  }

  // Shared by both reads so the field mapping cannot drift between them.
  private toStorageVideo(video: BunnyVideo): StorageVideo {
    return {
      providerId: video.guid,
      duration: video.length,
      views: video.views,
      status: video.status,
    };
  }

  getPlayerUrl(providerId: string): Either<Error, string> {
    try {
      const { cdn, playerUrl } = this.streamConfig;

      const expires = moment().add(cdn.expiresInMinutes, 'minutes').unix();
      const hashableBase = cdn.privateKey + providerId + expires;
      const token = createHash('sha256').update(hashableBase).digest('hex');

      const url = new URL(`${playerUrl}/${providerId}`);

      url.searchParams.set('token', token);
      url.searchParams.set('expires', expires.toString());
      url.searchParams.set('autoplay', 'false');
      url.searchParams.set('loop', 'false');
      url.searchParams.set('muted', 'false');
      url.searchParams.set('preload', 'true');
      url.searchParams.set('responsive', 'true');

      return right(url.toString());
    } catch (error) {
      return left(error);
    }
  }

  async getDownloadUrl(providerId: string): Promise<Either<Error, string>> {
    try {
      const { cdn } = this.streamConfig;

      const response = await this.httpClient.get<BunnyVideo>(`videos/${providerId}`);
      const availableResolutions = response.data.availableResolutions;

      if (!availableResolutions) {
        throw new Error('No available resolutions');
      }

      const resolutions = availableResolutions.split(',').map((resolution) => {
        return +resolution.replace('p', '');
      });

      const maxResolution = _.max(resolutions);
      const path = `/${providerId}/play_${maxResolution}p.mp4`;
      const expires = moment().add(cdn.expiresInMinutes, 'minutes').unix();
      const hashableBase = cdn.privateKey + path + expires;
      const md5String = createHash('md5').update(hashableBase).digest('binary');

      const token = Buffer.from(md5String, 'binary')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const url = new URL(cdn.url + path);

      url.searchParams.set('token', token);
      url.searchParams.set('expires', expires.toString());

      return right(url.toString());
    } catch (error) {
      return left(error);
    }
  }
}
