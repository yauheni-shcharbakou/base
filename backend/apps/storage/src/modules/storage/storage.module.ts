import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import axios from 'axios';
import { StorageFileService } from './domain/services/storage.file.service';
import { StorageVideoService } from './domain/services/storage.video.service';
import {
  BunnyStorageConfig,
  bunnyStorageConfig,
} from './infrastructure/configs/bunny.storage.config';
import { FILE_HTTP_CLIENT, VIDEO_HTTP_CLIENT } from './infrastructure/constants/http.tokens';
import { BunnyStorageFileServiceImpl } from './infrastructure/services/bunny.storage.file.service.impl';
import { BunnyStorageVideoServiceImpl } from './infrastructure/services/bunny.storage.video.service.impl';

@Module({
  imports: [ConfigModule.forFeature(bunnyStorageConfig)],
  providers: [
    {
      provide: FILE_HTTP_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<BunnyStorageConfig>) => {
        const { apiUrl, apiKey } = configService.getOrThrow('bunny.storage', { infer: true });

        return axios.create({
          baseURL: apiUrl,
          headers: {
            AccessKey: apiKey,
          },
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
