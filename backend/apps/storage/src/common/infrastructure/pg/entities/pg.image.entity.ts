import { PgEntity, PgProp, PgSchema } from '@backend/pg';
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

  @Property({ persist: false, type: 'string' })
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

  // Set once, by the image module's preview step: a small webp beside the original, or the original
  // itself when it is already light (ADR-0027).
  @Property({ nullable: true })
  previewProviderId?: string;

  // When the preview step gave up on an image a retry cannot help — undecodable bytes, a missing
  // object. The sweep skips such a row; clearing the column by hand queues it again. Hidden: the
  // proto `Image` has no such field.
  @PgProp.Date({ nullable: true, hidden: true })
  previewFailedAt?: Date;

  // Sweeps that came back from this image with a failure a retry might fix. At the sweep's
  // `maxAttempts` the row is given up on like the ones above (ADR-0037); a row marked failed with
  // fewer is one a retry cannot help. Hidden, like the mark.
  @Property({ default: 0, hidden: true })
  previewAttempts?: number;
}
