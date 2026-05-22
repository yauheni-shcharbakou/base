import { PgEntity, PgProp, PgSchema } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { Collection, Ref } from '@mikro-orm/core';
import { ManyToOne, OneToMany, OneToOne, Property } from '@mikro-orm/decorators/legacy';
import { PgFileEntity } from '@modules/file/infrastructure/pg/entities/pg.file.entity';
import { PgImageEntity } from '@modules/image/infrastructure/pg/entities/pg.image.entity';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import { PgVideoEntity } from '@modules/video/infrastructure/pg/entities/pg.video.entity';
import { StorageDatabaseEntity } from '@packages/common';

@PgSchema({ tableName: StorageDatabaseEntity.STORAGE_OBJECT })
export class PgStorageObjectEntity
  extends PgEntity<'children' | 'isDeleted'>
  implements StorageObject
{
  @Property({ index: true })
  userId: string;

  @Property({ index: true })
  name: string;

  @Property({ index: true, default: false })
  isPublic: boolean;

  @Property({ index: true, default: false })
  isFolder: boolean;

  @Property({ index: true, default: false })
  isDeleted = false;

  @PgProp.Enum({ enum: NestStorage.StorageObjectType, index: true })
  type: NestStorage.StorageObjectType;

  @ManyToOne({
    entity: () => PgStorageObjectEntity,
    nullable: true,
    ref: true,
  })
  parent?: Ref<PgStorageObjectEntity>;

  @Property({ persist: false })
  get parentId() {
    return this.parent?.id;
  }

  @OneToMany({
    entity: () => PgStorageObjectEntity,
    mappedBy: 'parent',
  })
  children = new Collection<PgStorageObjectEntity>(this);

  @OneToOne({
    entity: () => PgFileEntity,
    mappedBy: 'storageObject',
    owner: true,
    nullable: true,
    deleteRule: 'cascade',
    ref: true,
  })
  file?: Ref<NestStorage.File>;

  @Property({ persist: false })
  get fileId() {
    return this.file?.id;
  }

  @Property({ nullable: true })
  folderPath?: string;

  @OneToOne({
    entity: () => PgImageEntity,
    mappedBy: 'storageObject',
    owner: true,
    nullable: true,
    deleteRule: 'cascade',
    ref: true,
  })
  image?: Ref<NestStorage.Image>;

  @Property({ persist: false })
  get imageId() {
    return this.image?.id;
  }

  @OneToOne({
    entity: () => PgVideoEntity,
    mappedBy: 'storageObject',
    owner: true,
    nullable: true,
    deleteRule: 'cascade',
    ref: true,
  })
  video?: Ref<NestStorage.Video>;

  @Property({ persist: false })
  get videoId() {
    return this.video?.id;
  }
}
