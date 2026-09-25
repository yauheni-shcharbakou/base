import { S3Client } from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import axios from 'axios';
import { StorageFileService } from './domain/services/storage.file.service';
import { StorageVideoService } from './domain/services/storage.video.service';
import {
  BunnyStorageConfig,
  bunnyStorageConfig,
} from './infrastructure/configs/bunny.storage.config';
import { FILE_S3_CLIENT, VIDEO_HTTP_CLIENT } from './infrastructure/constants/client.tokens';
import { BunnyStorageFileServiceImpl } from './infrastructure/services/bunny.storage.file.service.impl';
import { BunnyStorageVideoServiceImpl } from './infrastructure/services/bunny.storage.video.service.impl';

@Module({
  imports: [ConfigModule.forFeature(bunnyStorageConfig)],
  providers: [
    {
      provide: FILE_S3_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<BunnyStorageConfig>) => {
        const { endpoint, region, accessKeyId, secretAccessKey } = configService.getOrThrow(
          'bunny.storage.s3',
          { infer: true },
        );

        // Bunny serves path-style URLs only. Checksums only when an operation demands one: the
        // SDK's default CRC32 trailer turns a streamed body into aws-chunked encoding, which an
        // S3-compatible endpoint is not guaranteed to accept.
        return new S3Client({
          endpoint,
          region,
          forcePathStyle: true,
          credentials: { accessKeyId, secretAccessKey },
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
        });
      },
    },
    {
      provide: VIDEO_HTTP_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<BunnyStorageConfig>) => {
        const { apiUrl, apiKey } = configService.getOrThrow('bunny.stream', { infer: true });

        return axios.create({
          baseURL: apiUrl,
          headers: {
            AccessKey: apiKey,
          },
        });
      },
    },
    {
      provide: StorageFileService,
      useClass: BunnyStorageFileServiceImpl,
    },
    {
      provide: StorageVideoService,
      useClass: BunnyStorageVideoServiceImpl,
    },
  ],
  exports: [StorageFileService, StorageVideoService],
})
export class StorageModule {}
