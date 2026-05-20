import { MigrationTask } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { EntityManager } from '@mikro-orm/postgresql';
import { PgStorageObjectEntity } from '@modules/storage-object/infrastructure/pg/entities/pg.storage-object.entity';
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
