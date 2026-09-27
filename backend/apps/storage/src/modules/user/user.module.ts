import { GrpcModule } from '@backend/grpc';
import { GrpcUserTransport } from '@backend/proto';
import { FileModule } from '@modules/file/file.module';
import { StorageObjectModule } from '@modules/storage-object/storage-object.module';
import { Module } from '@nestjs/common';
import { UserPurgeDeletedUseCase } from './application/use-cases/user.purge-deleted.use-case';
import { UserDirectoryService } from './domain/services/user-directory.service';
import { GrpcUserDirectoryServiceImpl } from './infrastructure/grpc/grpc.user-directory.service.impl';
import { CronUserScheduler } from './interface/cron/cron.user.scheduler';

/** Keeps storage in step with the users auth holds; the one place the runtime calls auth. */
@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        auth: [GrpcUserTransport.service],
      },
    }),
    FileModule,
    StorageObjectModule,
  ],
  providers: [
    {
      provide: UserDirectoryService,
      useClass: GrpcUserDirectoryServiceImpl,
    },
    UserPurgeDeletedUseCase,
    CronUserScheduler,
  ],
})
export class UserModule {}
