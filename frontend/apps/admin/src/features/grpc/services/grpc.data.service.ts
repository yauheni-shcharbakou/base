import { ConfigService } from '@/common/services/config.service';
import { GrpcDataRepository } from '@/features/grpc/types';
import {
  GrpcFileAdminRepository,
  GrpcImageAdminRepository,
  GrpcStorageObjectAdminRepository,
  GrpcTempCodeAdminRepository,
  GrpcUserAdminRepository,
  GrpcVideoAdminRepository,
} from '@frontend/proto';
import { AuthDatabaseEntity, StorageDatabaseEntity } from '@packages/common';
import { BaseRecord } from '@refinedev/core';

export class GrpcDataService {
  constructor(private readonly configService: ConfigService) {}

  private readonly grpcUrl = this.configService.getGrpcUrl();

  private readonly repositories: Record<string, Partial<GrpcDataRepository<any>>> = {
    [AuthDatabaseEntity.USER]: new GrpcUserAdminRepository(this.grpcUrl),
    [AuthDatabaseEntity.TEMP_CODE]: new GrpcTempCodeAdminRepository(this.grpcUrl),
    [StorageDatabaseEntity.FILE]: new GrpcFileAdminRepository(this.grpcUrl),
    [StorageDatabaseEntity.IMAGE]: new GrpcImageAdminRepository(this.grpcUrl),
    [StorageDatabaseEntity.STORAGE_OBJECT]: new GrpcStorageObjectAdminRepository(this.grpcUrl),
    [StorageDatabaseEntity.VIDEO]: new GrpcVideoAdminRepository(this.grpcUrl),
  };

  getRepository<Entity extends BaseRecord>(resource: string): GrpcDataRepository<Entity> {
    const repository = this.repositories[resource] as unknown as GrpcDataRepository<Entity>;

    if (!repository) {
      throw new Error('Repository not found');
    }

    return repository;
  }
}
