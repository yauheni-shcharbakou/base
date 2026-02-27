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
export class StorageObjectEntity
  extends PostgresEntity<'children'>
  implements Omit<GrpcStorageObject, 'video' | 'image' | 'file' | 'parent'>
{
  @Property({ index: true })
  user: string;

  @Property()
  name: string;

  @Property({ index: true, default: false })
  isPublic: boolean;

  @PostgresProp.Enum({ enum: GrpcStorageObjectType, index: true })
  type: GrpcStorageObjectType;

  @ManyToOne(() => StorageObjectEntity, { nullable: true, ref: true })
  parent?: Ref<StorageObjectEntity>;

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

  @OneToOne({
    entity: 'VideoEntity',
    mappedBy: 'storageObject',
    owner: true,
    nullable: true,
    deleteRule: 'cascade',
    ref: true,
  })
  video?: Ref<GrpcVideo>;
}
