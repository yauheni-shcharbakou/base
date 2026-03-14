import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BunnyVideoStorageServiceImpl } from 'common/services/video-storage/impl/bunny.video-storage.service.impl';
import { VIDEO_STORAGE_SERVICE } from 'common/services/video-storage/video-storage.service';
import { Config } from 'config';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Config>) => {
        const { apiUrl, apiKey } = configService.getOrThrow('bunny.stream', { infer: true });

        return {
          baseURL: apiUrl,
          headers: {
            AccessKey: apiKey,
          },
        };
      },
    }),
  ],
  providers: [
    {
      provide: VIDEO_STORAGE_SERVICE,
      useClass: BunnyVideoStorageServiceImpl,
    },
  ],
  exports: [VIDEO_STORAGE_SERVICE],
})
export class VideoStorageServiceModule {}
