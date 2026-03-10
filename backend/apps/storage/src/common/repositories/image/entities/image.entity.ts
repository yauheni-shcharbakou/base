import { PostgresEntity, PostgresSchema } from '@backend/persistence';
import { Cascade, OneToOne, Property, Ref } from '@mikro-orm/core';
import { StorageDatabaseEntity } from '@packages/common';
import { GrpcFile, GrpcImage, GrpcStorageObject } from '@backend/grpc';

@PostgresSchema({ tableName: StorageDatabaseEntity.IMAGE })
export class ImageEntity extends PostgresEntity implements GrpcImage {
  @Property({ index: true })
  userId: string;

  @OneToOne({
    entity: 'FileEntity',
    mappedBy: 'image',
    owner: true,
    deleteRule: 'cascade',
    ref: true,
  })
  file: Ref<GrpcFile>;

  @Property({ persist: false })
  get fileId() {
    return this.file.id;
  }

  @OneToOne({
    entity: 'StorageObjectEntity',
    mappedBy: 'image',
    cascade: [Cascade.REMOVE],
    orphanRemoval: true,
    nullable: true,
    ref: true,
  })
  storageObject?: Ref<GrpcStorageObject>;

  @Property()
  width: number;

  @Property()
  height: number;

  @Property()
  alt: string;
}
