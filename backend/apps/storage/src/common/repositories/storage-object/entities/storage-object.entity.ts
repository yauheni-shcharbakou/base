import {
  GrpcFile,
  GrpcImage,
  GrpcStorageObject,
  GrpcStorageObjectType,
  GrpcVideo,
} from '@backend/grpc';
import { PostgresEntity, PostgresProp, PostgresSchema } from '@backend/persistence';
import { Collection, Ref } from '@mikro-orm/core';
import { ManyToOne, OneToMany, OneToOne, Property } from '@mikro-orm/decorators/legacy';
import { StorageDatabaseEntity } from '@packages/common';
import { FileEntity } from 'common/repositories/file/entities/file.entity';
import { ImageEntity } from 'common/repositories/image/entities/image.entity';
import { VideoEntity } from 'common/repositories/video/entities/video.entity';

@PostgresSchema({ tableName: StorageDatabaseEntity.STORAGE_OBJECT })
export class StorageObjectEntity extends PostgresEntity<'children'> implements GrpcStorageObject {
  @Property({ index: true })
  userId: string;

  @Property({ index: true })
  name: string;

  @Property({ index: true, default: false })
  isPublic: boolean;

  @Property({ index: true, default: false })
  isFolder: boolean;

  @PostgresProp.Enum({ enum: GrpcStorageObjectType, index: true })
  type: GrpcStorageObjectType;

  @ManyToOne({
    entity: () => StorageObjectEntity,
    nullable: true,
    ref: true,
  })
  parent?: Ref<StorageObjectEntity>;

  @Property({ persist: false })
  get parentId() {
    return this.parent?.id;
  }

  @OneToMany({
    entity: () => StorageObjectEntity,
    mappedBy: 'parent',
  })
  children = new Collection<StorageObjectEntity>(this);

  @OneToOne({
    entity: () => FileEntity,
    mappedBy: 'storageObject',
    owner: true,
    nullable: true,
    deleteRule: 'cascade',
    ref: true,
  })
  file?: Ref<GrpcFile>;

  @Property({ persist: false })
  get fileId() {
    return this.file?.id;
  }

  @Property({ nullable: true })
  folderPath?: string;

  @OneToOne({
    entity: () => ImageEntity,
    mappedBy: 'storageObject',
    owner: true,
    nullable: true,
    deleteRule: 'cascade',
    ref: true,
  })
  image?: Ref<GrpcImage>;

  @Property({ persist: false })
  get imageId() {
    return this.image?.id;
  }

  @OneToOne({
    entity: () => VideoEntity,
    mappedBy: 'storageObject',
    owner: true,
    nullable: true,
    deleteRule: 'cascade',
    ref: true,
  })
  video?: Ref<GrpcVideo>;

  @Property({ persist: false })
  get videoId() {
    return this.video?.id;
  }
}
