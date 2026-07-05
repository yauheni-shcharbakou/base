import { PgEntity, PgSchema } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { Cascade, Ref } from '@mikro-orm/core';
import { OneToOne, Property } from '@mikro-orm/decorators/legacy';
import { StorageDatabaseEntity } from '@packages/common';

@PgSchema({ tableName: StorageDatabaseEntity.IMAGE })
export class PgImageEntity extends PgEntity implements NestStorage.Image {
  @Property({ index: true })
  userId: string;

  @OneToOne({
    entity: () => PgFileEntity,
    mappedBy: 'image',
    owner: true,
    deleteRule: 'cascade',
    ref: true,
  })
  file: Ref<NestStorage.File>;

  @Property({ persist: false })
  get fileId() {
    return this.file.id;
  }

  @OneToOne({
    entity: () => PgStorageObjectEntity,
    mappedBy: 'image',
    cascade: [Cascade.REMOVE],
    orphanRemoval: true,
    nullable: true,
    ref: true,
  })
  storageObject?: Ref<NestStorage.StorageObject>;

  @Property()
  width: number;

  @Property()
  height: number;

  @Property()
  alt: string;

  @Property()
  uploadId: string;
}
