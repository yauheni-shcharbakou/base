import { MigrationTask } from '@backend/common';
import { InjectGrpcService } from '@backend/grpc';
import { GrpcUserServiceClient, GrpcUserTransport, NestStorage } from '@backend/proto';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import _ from 'lodash';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CreateRootFoldersTask implements MigrationTask {
  constructor(
    private readonly entityManager: EntityManager,
    @InjectGrpcService(GrpcUserTransport.service)
    private readonly userServiceClient: GrpcUserServiceClient,
  ) {}

  async up() {
    const users = await firstValueFrom(this.userServiceClient.getMany({ ids: [], roles: [] }));

    // A root folder is unique per user in the database, so a rerun (this task is retried until it
    // succeeds) must skip the users that already have one instead of hitting the constraint.
    const existingRootFolders = await this.entityManager.find(
      PgStorageObjectEntity,
      { isFolder: true, parent: null },
      { fields: ['userId'] },
    );

    const userIdsWithRootFolder = new Set(_.map(existingRootFolders, 'userId'));

    _.forEach(users.items, (user) => {
      if (userIdsWithRootFolder.has(user.id)) {
        return;
      }

      const folder = this.entityManager.create(PgStorageObjectEntity, {
        userId: user.id,
        type: NestStorage.StorageObjectType.FOLDER,
        name: '',
        isPublic: false,
        isFolder: true,
      });

      this.entityManager.persist(folder);
    });

    await this.entityManager.flush();
  }
}
