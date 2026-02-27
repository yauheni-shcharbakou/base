import { GrpcStorageObjectType, GrpcUserService, GrpcUserServiceClient } from '@backend/grpc';
import { MigrationTask } from '@backend/persistence';
import { InjectGrpcService } from '@backend/transport';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { StorageObjectEntity } from 'common/repositories/storage-object/entities/storage-object.entity';
import _ from 'lodash';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CreateRootFoldersTask implements MigrationTask {
  constructor(
    private readonly entityManager: EntityManager,
    @InjectGrpcService(GrpcUserService.name)
    private readonly userServiceClient: GrpcUserServiceClient,
  ) {}

  async up() {
    const users = await firstValueFrom(
      this.userServiceClient.getMany({ query: { ids: [], roles: [] } }),
    );

    _.forEach(users.items, (user) => {
      const folder = this.entityManager.create(StorageObjectEntity, {
        user: user.id,
        type: GrpcStorageObjectType.FOLDER,
        name: '',
        isPublic: false,
        folderPath: '/',
      });

      this.entityManager.persist(folder);
    });

    await this.entityManager.flush();
  }
}
