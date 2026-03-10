import { PostgresEntity, PostgresProp, PostgresSchema } from '@backend/persistence';
import { Collection, ManyToOne, OneToMany, OneToOne, Property, Ref } from '@mikro-orm/core';
import { StorageDatabaseEntity } from '@packages/common';
import {
  GrpcStorageObject,
  GrpcStorageObjectType,
  GrpcFile,
  GrpcImage,
  GrpcVideo,
} from '@backend/grpc';

@PostgresSchema({ tableName: StorageDatabaseEntity.STORAGE_OBJECT })
export class StorageObjectEntity extends PostgresEntity<'children'> implements GrpcStorageObject {
  @Property({ index: true })
  userId: string;

  @Property()
  name: string;

  @Property({ index: true, default: false })
  isPublic: boolean;

  @PostgresProp.Enum({ enum: GrpcStorageObjectType, index: true })
  type: GrpcStorageObjectType;

  @ManyToOne(() => StorageObjectEntity, { nullable: true, ref: true })
  parent?: Ref<StorageObjectEntity>;

  @Property({ persist: false })
  get parentId() {
    return this.parent?.id;
  }

  @OneToMany(() => StorageObjectEntity, (child) => child.parent)
  children = new Collection<StorageObjectEntity>(this);

  @OneToOne({
    entity: 'FileEntity',
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
    entity: 'ImageEntity',
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
    entity: 'VideoEntity',
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
