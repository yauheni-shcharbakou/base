import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BunnyFileStorageServiceImpl } from 'common/services/file-storage/impl/bunny.file-storage.service.impl';
import { FILE_STORAGE_SERVICE } from 'common/services/file-storage/file-storage.service';
import { Config } from 'config';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Config>) => {
        const { apiUrl, apiKey } = configService.getOrThrow('bunny.storage', { infer: true });

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
      provide: FILE_STORAGE_SERVICE,
      useClass: BunnyFileStorageServiceImpl,
    },
  ],
  exports: [FILE_STORAGE_SERVICE],
})
export class FileStorageServiceModule {}
