import { PgModule } from '@backend/pg';
import { StorageObjectModule } from '@modules/storage-object/storage-object.module';
import { StorageModule } from '@modules/storage/storage.module';
import { Module } from '@nestjs/common';
import { FileCreateService } from './application/services/file.create.service';
import { FileCleanupUseCase } from './application/use-cases/file.cleanup.use-case';
import { FileCreateManyUseCase } from './application/use-cases/file.create-many.use-case';
import { FileCreateOneUseCase } from './application/use-cases/file.create-one.use-case';
import { FileDeleteUseCase } from './application/use-cases/file.delete.use-case';
import { FileGetDownloadMapUseCase } from './application/use-cases/file.get-download-map.use-case';
import { FileGetUrlMapUseCase } from './application/use-cases/file.get-url-map.use-case';
import { FileGetUseCase } from './application/use-cases/file.get.use-case';
import { FileUpdateUseCase } from './application/use-cases/file.update.use-case';
import { FileUploadOneUseCase } from './application/use-cases/file.upload-one.use-case';
import { FileRepository } from './domain/repositories/file.repository';
import { FileCronService } from './infrastructure/cron/services/file.cron.service';
import { PgFileEntity } from './infrastructure/pg/entities/pg.file.entity';
import { PgFileRepositoryImpl } from './infrastructure/pg/repositories/pg.file.repository.impl';
import { GrpcFileController } from './interface/grpc/grpc.file.controller';
import { NatsFileController } from './interface/nats/nats.file.controller';

@Module({
  imports: [PgModule.forFeature(PgFileEntity), StorageModule, StorageObjectModule],
  providers: [
    {
      provide: FileRepository,
      useClass: PgFileRepositoryImpl,
    },
    FileCreateService,
    FileGetUrlMapUseCase,
    FileGetDownloadMapUseCase,
    FileGetUseCase,
    FileCreateOneUseCase,
    FileCreateManyUseCase,
    FileUploadOneUseCase,
    FileDeleteUseCase,
    FileCleanupUseCase,
    FileUpdateUseCase,
    FileCronService,
  ],
  controllers: [GrpcFileController, NatsFileController],
  exports: [FileCreateService],
})
export class FileModule {}
