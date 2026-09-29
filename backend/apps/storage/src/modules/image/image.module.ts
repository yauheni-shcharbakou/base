import { PgModule } from '@backend/pg';
import { PgImageEntity } from '@common/infrastructure/pg/entities/pg.image.entity';
import { FileModule } from '@modules/file/file.module';
import { StorageObjectModule } from '@modules/storage-object/storage-object.module';
import { StorageModule } from '@modules/storage/storage.module';
import { Module } from '@nestjs/common';
import { ImageCreateManyUseCase } from './application/use-cases/image.create-many.use-case';
import { ImageCreateOneUseCase } from './application/use-cases/image.create-one.use-case';
import { ImageDeleteOneUseCase } from './application/use-cases/image.delete-one.use-case';
import { ImageGetUseCase } from './application/use-cases/image.get.use-case';
import { ImageMakePreviewUseCase } from './application/use-cases/image.make-preview.use-case';
import { ImageSweepPreviewsUseCase } from './application/use-cases/image.sweep-previews.use-case';
import { ImageUpdateUseCase } from './application/use-cases/image.update.use-case';
import { ImageRepository } from './domain/repositories/image.repository';
import { ImagePreviewService } from './domain/services/image.preview.service';
import { PgImageRepositoryImpl } from './infrastructure/pg/repositories/pg.image.repository.impl';
import { SharpImagePreviewServiceImpl } from './infrastructure/services/sharp.image.preview.service.impl';
import { CronImageScheduler } from './interface/cron/cron.image.scheduler';
import { GrpcImageController } from './interface/grpc/grpc.image.controller';
import { RedisImageController } from './interface/redis/redis.image.controller';

@Module({
  imports: [PgModule.forFeature(PgImageEntity), StorageModule, FileModule, StorageObjectModule],
  providers: [
    {
      provide: ImageRepository,
      useClass: PgImageRepositoryImpl,
    },
    ImageGetUseCase,
    ImageDeleteOneUseCase,
    ImageCreateOneUseCase,
    ImageCreateManyUseCase,
    ImageUpdateUseCase,
    {
      provide: ImagePreviewService,
      useClass: SharpImagePreviewServiceImpl,
    },
    ImageMakePreviewUseCase,
    ImageSweepPreviewsUseCase,
    CronImageScheduler,
  ],
  controllers: [GrpcImageController, RedisImageController],
})
export class ImageModule {}
