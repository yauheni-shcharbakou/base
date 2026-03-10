import { ConfigService } from '@/common/services/config.service';
import { GrpcDataRepository } from '@/features/grpc/types';
import {
  GrpcFileRepository,
  GrpcImageRepository,
  GrpcStorageObjectRepository,
  GrpcUserRepository,
  GrpcVideoRepository,
} from '@frontend/grpc';
import { AuthDatabaseEntity, StorageDatabaseEntity } from '@packages/common';
import { BaseRecord } from '@refinedev/core';

export class GrpcDataService {
  constructor(private readonly configService: ConfigService) {}

  private readonly grpcUrl = this.configService.getGrpcUrl();

  private readonly repositories: Record<string, Partial<GrpcDataRepository<any>>> = {
    [AuthDatabaseEntity.USER]: new GrpcUserRepository(this.grpcUrl),
    [StorageDatabaseEntity.FILE]: new GrpcFileRepository(this.grpcUrl),
    [StorageDatabaseEntity.IMAGE]: new GrpcImageRepository(this.grpcUrl),
    [StorageDatabaseEntity.STORAGE_OBJECT]: new GrpcStorageObjectRepository(this.grpcUrl),
    [StorageDatabaseEntity.VIDEO]: new GrpcVideoRepository(this.grpcUrl),
  };

  getRepository<Entity extends BaseRecord>(resource: string): GrpcDataRepository<Entity> {
    const repository = this.repositories[resource] as unknown as GrpcDataRepository<Entity>;

    if (!repository) {
      throw new Error('Repository not found');
    }

    return repository;
  }
}
