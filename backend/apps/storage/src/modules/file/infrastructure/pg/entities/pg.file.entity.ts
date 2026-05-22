import { PgEntity, PgProp, PgSchema } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { Cascade, Ref } from '@mikro-orm/core';
import { OneToOne, Property } from '@mikro-orm/decorators/legacy';
import { PgImageEntity } from '@modules/image/infrastructure/pg/entities/pg.image.entity';
import { PgStorageObjectEntity } from '@modules/storage-object/infrastructure/pg/entities/pg.storage-object.entity';
import { PgVideoEntity } from '@modules/video/infrastructure/pg/entities/pg.video.entity';
import { StorageDatabaseEntity } from '@packages/common';

@PgSchema({ tableName: StorageDatabaseEntity.FILE })
export class PgFileEntity extends PgEntity implements NestStorage.File {
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

  @Property()
  uploadId: string;

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
