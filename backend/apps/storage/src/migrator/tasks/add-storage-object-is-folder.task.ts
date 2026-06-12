import { MigrationTask } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AddStorageObjectIsFolderTask implements MigrationTask {
  constructor(private readonly entityManager: EntityManager) {}

  async up() {
    await this.entityManager.nativeUpdate(
      PgStorageObjectEntity,
      { type: NestStorage.StorageObjectType.FOLDER },
      { isFolder: true },
    );
  }
}
