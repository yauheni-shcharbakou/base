import { NatsModule, NatsStorageVideoTransport } from '@backend/nats';
import { PgModule } from '@backend/pg';
import { FileModule } from '@modules/file/file.module';
import { StorageObjectModule } from '@modules/storage-object/storage-object.module';
import { StorageModule } from '@modules/storage/storage.module';
import { Module } from '@nestjs/common';
import { VideoCreateManyUseCase } from './application/use-cases/video.create-many.use-case';
import { VideoCreateOneUseCase } from './application/use-cases/video.create-one.use-case';
import { VideoDeleteOneUseCase } from './application/use-cases/video.delete-one.use-case';
import { VideoGetDownloadMapUseCase } from './application/use-cases/video.get-download-map.use-case';
import { VideoGetUrlMapUseCase } from './application/use-cases/video.get-url-map.use-case';
import { VideoGetUseCase } from './application/use-cases/video.get.use-case';
import { VideoSyncWithProviderUseCase } from './application/use-cases/video.sync-with-provider.use-case';
import { VideoUpdateUseCase } from './application/use-cases/video.update.use-case';
import { VideoUploadOneUseCase } from './application/use-cases/video.upload-one.use-case';
import { VideoRepository } from './domain/repositories/video.repository';
import { VideoCronService } from './infrastructure/cron/services/video.cron.service';
import { PgVideoEntity } from './infrastructure/pg/entities/pg.video.entity';
import { PgVideoRepositoryImpl } from './infrastructure/pg/repositories/pg.video.repository.impl';
import { GrpcVideoRepository } from './interface/grpc/grpc.video.repository';

@Module({
  imports: [
    PgModule.forFeature(PgVideoEntity),
    NatsModule.forFeature({ EventBus: NatsStorageVideoTransport.EventBus }),
    StorageModule,
    FileModule,
    StorageObjectModule,
  ],
  providers: [
    {
      provide: VideoRepository,
      useClass: PgVideoRepositoryImpl,
    },
    VideoGetUseCase,
    VideoGetUrlMapUseCase,
    VideoGetDownloadMapUseCase,
    VideoDeleteOneUseCase,
    VideoUpdateUseCase,
    VideoCreateOneUseCase,
    VideoCreateManyUseCase,
    VideoUploadOneUseCase,
    VideoSyncWithProviderUseCase,
    VideoCronService,
  ],
  controllers: [GrpcVideoRepository],
})
export class VideoModule {}
