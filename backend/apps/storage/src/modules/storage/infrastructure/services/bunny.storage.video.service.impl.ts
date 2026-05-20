import { NestStorage } from '@backend/proto';
import {
  StorageVideoCreateData,
  StorageVideoList,
  StorageVideoService,
} from '@modules/storage/domain/services/storage.video.service';
import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Either, left, right } from '@sweet-monads/either';
import { AxiosError, AxiosInstance } from 'axios';
import https from 'https';
import _ from 'lodash';
import moment from 'moment';
import { createHash } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { BunnyStorageConfig } from '../configs/bunny.storage.config';
import { VIDEO_HTTP_CLIENT } from '../constants/http.tokens';
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

  uploadVideo(providerId: string, fileSize: number, upload$: PassThrough): Promise<boolean> {
    const { apiUrl, apiKey } = this.streamConfig;
    const url = new URL(`${apiUrl}/videos/${providerId}`);

    return new Promise<boolean>((resolve) => {
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: 'PUT',
          headers: {
            AccessKey: apiKey,
            'Content-Type': 'application/octet-stream',
            'Content-Length': fileSize.toString(),
          },
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
        },
      );

      req.on('error', (err) => {
        this.logger.error('Upload error', err.message, err.stack);
        resolve(false);
      });

      upload$.on('error', (err) => {
        if (!req.destroyed) {
          req.destroy(err);
        }
      });

      upload$.pipe(req);
    });
  }

  async deleteVideo(providerId: string): Promise<Either<InternalServerErrorException, boolean>> {
    try {
      await this.httpClient.delete(`videos/${providerId}`);
      return right(true);
    } catch (e) {
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

  async getList(page: number, limit: number): Promise<StorageVideoList> {
    try {
      const response = await this.httpClient.get<BunnyVideoList>(
        `videos?page=${page}&itemsPerPage=${limit}`,
      );

      return {
        total: response.data.totalItems,
        items: _.map(response.data.items, (item) => {
          return {
            providerId: item.guid,
            duration: item.length,
            views: item.views,
          };
        }),
      };
    } catch (e) {
      return { total: 0, items: [] };
    }
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
