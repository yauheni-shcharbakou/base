import { PgEntity, PgProp, PgSchema } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgImageEntity } from '@common/infrastructure/pg/entities/pg.image.entity';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { PgVideoEntity } from '@common/infrastructure/pg/entities/pg.video.entity';
import { Cascade, Ref } from '@mikro-orm/core';
import { OneToOne, Property } from '@mikro-orm/decorators/legacy';
import { StorageDatabaseEntity } from '@packages/common';

@PgSchema({ tableName: StorageDatabaseEntity.FILE })
export class PgFileEntity
  extends PgEntity<'image' | 'video' | 'storageObject'>
  implements NestStorage.File
{
  @Property({ index: true })
  userId: string;

  @Property()
  originalName: string;

  @Property()
  size: number;

  @Property()
  mimeType: string;

  @Property()
  extension: string;

  @PgProp.Enum({
    enum: NestStorage.FileUploadStatus,
    default: NestStorage.FileUploadStatus.PENDING,
    index: true,
  })
  uploadStatus: NestStorage.FileUploadStatus;

  @Property({ nullable: true, index: true })
  providerId?: string;

  // Set once, by the document module's preview step: the first page of a PDF as a small webp beside
  // the original (ADR-0032). An image's is on the image row, never here.
  @Property({ nullable: true })
  previewProviderId?: string;

  // When the preview step gave up on a file a retry cannot help — undecodable, protected, too heavy,
  // a missing object. The sweep skips such a row; clearing the column by hand queues it again.
  // Hidden: the proto `File` has no such field.
  @PgProp.Date({ nullable: true, hidden: true })
  previewFailedAt?: Date;

  @OneToOne({
    entity: () => PgImageEntity,
    mappedBy: 'file',
    cascade: [Cascade.REMOVE],
    orphanRemoval: true,
    nullable: true,
    ref: true,
  })
  image?: Ref<NestStorage.Image>;

  @OneToOne({
    entity: () => PgVideoEntity,
    mappedBy: 'file',
    cascade: [Cascade.REMOVE],
    orphanRemoval: true,
    nullable: true,
    ref: true,
  })
  video?: Ref<NestStorage.Video>;

  @OneToOne({
    entity: () => PgStorageObjectEntity,
    mappedBy: 'file',
    cascade: [Cascade.REMOVE],
    orphanRemoval: true,
    nullable: true,
    ref: true,
  })
  storageObject?: Ref<NestStorage.StorageObject>;
}
