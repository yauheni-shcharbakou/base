import { ConfigService } from '@/common/services/config.service';
import { GrpcDataRepository } from '@/features/grpc/types';
import {
  GrpcFileRepository,
  GrpcFileServiceClient,
  GrpcStorageObjectRepository,
  GrpcUserRepository,
} from '@frontend/grpc';
import { ChannelCredentials } from '@grpc/grpc-js';
import { AuthDatabaseEntity, StorageDatabaseEntity } from '@packages/common';
import { BaseRecord } from '@refinedev/core';

export class GrpcDataService {
  constructor(private readonly configService: ConfigService) {}

  private readonly grpcUrl = this.configService.getGrpcUrl();

  private readonly clients = {
    [StorageDatabaseEntity.FILE]: new GrpcFileServiceClient(
      this.grpcUrl,
      ChannelCredentials.createInsecure(),
    ),
  } as const;

  private readonly repositories: Record<string, Partial<GrpcDataRepository<any>>> = {
    [AuthDatabaseEntity.USER]: new GrpcUserRepository(this.grpcUrl),
    [StorageDatabaseEntity.FILE]: new GrpcFileRepository(this.grpcUrl),
    [StorageDatabaseEntity.STORAGE_OBJECT]: new GrpcStorageObjectRepository(this.grpcUrl),
  };

  getClient<Entity extends keyof typeof this.clients>(
    entity: Entity,
  ): (typeof this.clients)[Entity] {
    return this.clients[entity];
  }

  getRepository<Entity extends BaseRecord>(resource: string): GrpcDataRepository<Entity> {
    const repository = this.repositories[resource] as unknown as GrpcDataRepository<Entity>;

    if (!repository) {
      throw new Error('Repository not found');
    }

    return repository;
  }
}
