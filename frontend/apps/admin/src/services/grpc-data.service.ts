import { ConfigService } from '@/services/config.service';
import { GrpcDataRepository } from '@/types/grpc.types';
import { GrpcFileRepository, GrpcUserRepository } from '@frontend/grpc';
import { AuthDatabaseCollection, FileDatabaseCollection } from '@packages/common';
import { BaseRecord } from '@refinedev/core';

export class GrpcDataService {
  constructor(private readonly configService: ConfigService) {}

  private readonly repositories: Record<string, Partial<GrpcDataRepository<any>>> = {
    [AuthDatabaseCollection.USER]: new GrpcUserRepository(this.configService.getGrpcUrl()),
    [FileDatabaseCollection.FILE]: new GrpcFileRepository(this.configService.getGrpcUrl()),
  };

  getRepository<Entity extends BaseRecord>(resource: string): GrpcDataRepository<Entity> {
    const repository = this.repositories[resource] as unknown as GrpcDataRepository<Entity>;

    if (!repository) {
      throw new Error('Repository not found');
    }

    return repository;
  }
}
