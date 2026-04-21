import { PostgresEntity, PostgresSchema } from '@backend/persistence';
import { Cascade, Ref } from '@mikro-orm/core';
import { StorageDatabaseEntity } from '@packages/common';
import { GrpcFile, GrpcStorageObject, GrpcVideo } from '@backend/grpc';
import { OneToOne, Property } from '@mikro-orm/decorators/legacy';
import { FileEntity } from 'common/repositories/file/entities/file.entity';
import { StorageObjectEntity } from 'common/repositories/storage-object/entities/storage-object.entity';

@PostgresSchema({ tableName: StorageDatabaseEntity.VIDEO })
export class VideoEntity extends PostgresEntity<'duration' | 'views'> implements GrpcVideo {
  @Property({ index: true })
  userId: string;

  @OneToOne({
    entity: () => FileEntity,
    mappedBy: 'video',
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
    entity: () => StorageObjectEntity,
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
