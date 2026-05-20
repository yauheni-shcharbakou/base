import { MigrationTask } from '@backend/common';
import { InjectGrpcService } from '@backend/grpc';
import { GrpcUserServiceClient, GrpcUserTransport, NestStorage } from '@backend/proto';
import { StorageObjectEntity } from '@common/repositories/storage-object/entities/storage-object.entity';
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

    _.forEach(users.users, (user) => {
      const folder = this.entityManager.create(StorageObjectEntity, {
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
