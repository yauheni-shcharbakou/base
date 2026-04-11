import { GrpcVideoUpdateSet } from '@backend/grpc';
import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Either, left, right } from '@sweet-monads/either';
import { AxiosError } from 'axios';
import {
  VideoStorageCreateData,
  VideoStorageList,
  VideoStorageService,
} from 'common/services/video-storage/video-storage.service';
import { Config } from 'config';
import _ from 'lodash';
import moment from 'moment';
import { createHash } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { firstValueFrom } from 'rxjs';
import https from 'https';

type UpdateBody = {
  title?: string;
  metaTags?: { property: string; value: string }[];
};

type BunnyVideo = {
  guid: string;
  title: string;
  description?: string;
  length: number;
  views: number;
  availableResolutions?: string;
};

type BunnyVideoList = {
  totalItems: number;
  items: BunnyVideo[];
};

@Injectable()
export class BunnyVideoStorageServiceImpl implements VideoStorageService {
  private readonly logger = new Logger(BunnyVideoStorageServiceImpl.name);
  private readonly streamConfig: Config['bunny']['stream'];

  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly httpService: HttpService,
  ) {
    this.httpService.axiosRef.interceptors.response.use(undefined, (axiosError: AxiosError) => {
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
    data: VideoStorageCreateData,
  ): Promise<Either<InternalServerErrorException, string>> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<BunnyVideo>('videos', { title: data.title }),
      );

      const id = response.data.guid;

      if (data.description) {
        await firstValueFrom(
          this.httpService.post(`videos/${id}`, {
            metaTags: [
              {
                property: 'description',
                value: data.description,
              },
            ],
          }),
        );
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

      upload$.pipe(req);
    });
  }

  async deleteVideo(providerId: string): Promise<Either<InternalServerErrorException, boolean>> {
    try {
      await firstValueFrom(this.httpService.delete(`videos/${providerId}`));
      return right(true);
    } catch (e) {
      return left(new InternalServerErrorException("Can't delete video from bunny stream"));
    }
  }

  async updateVideo(
    providerId: string,
    updateData: GrpcVideoUpdateSet,
  ): Promise<Either<Error, boolean>> {
    try {
      const body: UpdateBody = {};

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

      await firstValueFrom(this.httpService.post(`videos/${providerId}`, body));
      return right(true);
    } catch (e) {
      return left(e);
    }
  }

  async getList(page: number, limit: number): Promise<VideoStorageList> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<BunnyVideoList>(`videos?page=${page}&itemsPerPage=${limit}`),
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

      const response = await firstValueFrom(
        this.httpService.get<BunnyVideo>(`videos/${providerId}`),
      );

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
