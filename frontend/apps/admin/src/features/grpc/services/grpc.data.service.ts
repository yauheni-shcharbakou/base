import {
  fileGrpcRepository,
  imageGrpcRepository,
  storageObjectGrpcRepository,
  tempCodeGrpcRepository,
  userGrpcRepository,
  videoGrpcRepository,
} from '@/features/grpc/repositories';
import { GrpcDataRepository } from '@/features/grpc/types';
import { AuthDatabaseEntity, StorageDatabaseEntity } from '@packages/common';
import { BaseRecord } from '@refinedev/core';

export class GrpcDataService {
  private readonly repositories: Record<string, Partial<GrpcDataRepository<any>>> = {
    [AuthDatabaseEntity.USER]: userGrpcRepository,
    [AuthDatabaseEntity.TEMP_CODE]: tempCodeGrpcRepository,
    [StorageDatabaseEntity.FILE]: fileGrpcRepository,
    [StorageDatabaseEntity.IMAGE]: imageGrpcRepository,
    [StorageDatabaseEntity.STORAGE_OBJECT]: storageObjectGrpcRepository,
    [StorageDatabaseEntity.VIDEO]: videoGrpcRepository,
  };

  getRepository<Entity extends BaseRecord>(resource: string): GrpcDataRepository<Entity> {
    const repository = this.repositories[resource] as unknown as GrpcDataRepository<Entity>;

    if (!repository) {
      throw new Error('Repository not found');
    }

    return repository;
  }
}
