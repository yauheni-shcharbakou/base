import { PgEntity, PgSchema } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { Cascade, Ref } from '@mikro-orm/core';
import { OneToOne, Property } from '@mikro-orm/decorators/legacy';
import { StorageDatabaseEntity } from '@packages/common';

@PgSchema({ tableName: StorageDatabaseEntity.VIDEO })
export class PgVideoEntity extends PgEntity<'duration' | 'views'> implements NestStorage.Video {
  @Property({ index: true })
  userId: string;

  @OneToOne({
    entity: () => PgFileEntity,
    mappedBy: 'video',
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
    mappedBy: 'video',
    cascade: [Cascade.REMOVE],
    orphanRemoval: true,
    nullable: true,
    ref: true,
  })
  storageObject?: Ref<NestStorage.StorageObject>;

  @Property({ index: true })
  providerId: string;

  @Property()
  title: string;

  @Property({ default: 0 })
  duration: number = 0;

  @Property({ default: 0 })
  views: number = 0;

  @Property({ nullable: true })
  description?: string;

  @Property()
  uploadId: string;
}
