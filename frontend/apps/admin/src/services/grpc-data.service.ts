import { ConfigService } from '@/services/config.service';
import { GrpcDataRepository } from '@/types/grpc.types';
import { GrpcUserRepository } from '@frontend/grpc';
import { AuthDatabaseCollection } from '@packages/common';
import { BaseRecord } from '@refinedev/core';

export class GrpcDataService {
  constructor(private readonly configService: ConfigService) {}

  private readonly repositories: Record<string, GrpcDataRepository<any>> = {
    [AuthDatabaseCollection.USER]: new GrpcUserRepository(this.configService.getGrpcUrl()),
  };

  getRepository<Entity extends BaseRecord>(resource: string): GrpcDataRepository<Entity> {
    const repository = this.repositories[resource] as unknown as GrpcDataRepository<Entity>;

    if (!repository) {
      throw new Error('Repository not found');
    }

    return repository;
  }
}
