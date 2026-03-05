import { GrpcVideoMetadata } from '@backend/grpc';
import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Either, left, right } from '@sweet-monads/either';
import { AxiosError } from 'axios';
import { VideoStorageService } from 'common/services/video-storage/video-storage.service';
import { Config } from 'config';
import { PassThrough } from 'node:stream';
import { catchError, map, Observable, of, switchMap } from 'rxjs';

@Injectable()
export class BunnyVideoStorageServiceImpl implements VideoStorageService {
  private readonly logger = new Logger(BunnyVideoStorageServiceImpl.name);

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
  }

  createVideo(video: GrpcVideoMetadata): Observable<Either<InternalServerErrorException, string>> {
    return this.httpService.post<{ guid: string }>('videos', { title: video.title }).pipe(
      switchMap((response) => {
        const id = response.data.guid;

        if (!video.description) {
          return of(right(id));
        }

        return this.httpService
          .post(`videos/${id}`, {
            metaTags: [
              {
                property: 'description',
                value: video.description,
              },
            ],
          })
          .pipe(map(() => right(id)));
      }),
      catchError((err) => {
        return of(left(new InternalServerErrorException("Can't create video in Bunny Stream")));
      }),
    );
  }

  uploadVideo(providerId: string, fileSize: number, upload$: PassThrough): Observable<boolean> {
    return this.httpService
      .put(`videos/${providerId}`, upload$, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileSize.toString(),
        },
      })
      .pipe(map(() => true));
  }

  deleteVideo(providerId: string): Observable<Either<InternalServerErrorException, boolean>> {
    return this.httpService.delete(`videos/${providerId}`).pipe(
      map(() => right(true)),
      catchError((error) =>
        of(left(new InternalServerErrorException("Can't delete video from bunny stream"))),
      ),
    );
  }
}
