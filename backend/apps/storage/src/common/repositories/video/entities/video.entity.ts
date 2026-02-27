import { PostgresEntity, PostgresSchema } from '@backend/persistence';
import { Cascade, OneToOne, Property, Ref } from '@mikro-orm/core';
import { StorageDatabaseEntity } from '@packages/common';
import { GrpcFile, GrpcStorageObject, GrpcVideo } from '@backend/grpc';

@PostgresSchema({ tableName: StorageDatabaseEntity.VIDEO })
export class VideoEntity extends PostgresEntity implements Omit<GrpcVideo, 'file'> {
  @Property({ index: true })
  user: string;

  @OneToOne({
    entity: 'FileEntity',
    mappedBy: 'video',
    owner: true,
    deleteRule: 'cascade',
    ref: true,
  })
  file: Ref<GrpcFile>;

  @OneToOne({
    entity: 'StorageObjectEntity',
    mappedBy: 'video',
    cascade: [Cascade.REMOVE],
    orphanRemoval: true,
    nullable: true,
    ref: true,
  })
  storageObject?: Ref<GrpcStorageObject>;

  @Property({ index: true })
  providerId: string;

  @Property()
  duration: number;

  @Property()
  views: number;

  @Property({ nullable: true })
  description?: string;
}
