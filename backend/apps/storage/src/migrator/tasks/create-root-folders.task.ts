import { MigrationTask } from '@backend/common';
import { InjectGrpcService } from '@backend/grpc';
import { GrpcUserServiceClient, GrpcUserTransport, NestStorage } from '@backend/proto';
import { EntityManager } from '@mikro-orm/postgresql';
import { PgStorageObjectEntity } from '@modules/storage-object/infrastructure/pg/entities/pg.storage-object.entity';
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

    _.forEach(users.items, (user) => {
      const folder = this.entityManager.create(PgStorageObjectEntity, {
        userId: user.id,
        type: NestStorage.StorageObjectType.FOLDER,
        name: '',
        isPublic: false,
        folderPath: '/',
      });

      this.entityManager.persist(folder);
    });

    await this.entityManager.flush();
  }
}
