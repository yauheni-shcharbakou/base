import { GrpcStorageObjectType } from '@backend/grpc';
import { MigrationTask } from '@backend/persistence';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { StorageObjectEntity } from 'common/repositories/storage-object/entities/storage-object.entity';

@Injectable()
export class AddStorageObjectIsFolderTask implements MigrationTask {
  constructor(private readonly entityManager: EntityManager) {}

  async up() {
    await this.entityManager.nativeUpdate(
      StorageObjectEntity,
      { type: GrpcStorageObjectType.FOLDER },
      { isFolder: true },
    );
  }
}
