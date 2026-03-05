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
        const { url, apiKey, libraryId } = configService.getOrThrow('bunny.stream', {
          infer: true,
        });

        return {
          baseURL: `${url}/library/${libraryId}`,
          timeout: 0,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
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
