import {
  GrpcFile,
  GrpcFileUploadStatus,
  GrpcImage,
  GrpcStorageObject,
  GrpcVideo,
} from '@backend/grpc';
import { PostgresEntity, PostgresProp, PostgresSchema } from '@backend/persistence';
import { Cascade, OneToOne, Property, Ref } from '@mikro-orm/core';
import { StorageDatabaseEntity } from '@packages/common';

@PostgresSchema({ tableName: StorageDatabaseEntity.FILE })
export class FileEntity extends PostgresEntity implements GrpcFile {
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

  @PostgresProp.Enum({
    enum: GrpcFileUploadStatus,
    default: GrpcFileUploadStatus.PENDING,
    index: true,
  })
  uploadStatus: GrpcFileUploadStatus;

  @Property({ nullable: true, index: true })
  providerId?: string;

  @Property()
  uploadId: string;

  @OneToOne({
    entity: 'ImageEntity',
    mappedBy: 'file',
    cascade: [Cascade.REMOVE],
    orphanRemoval: true,
    nullable: true,
    ref: true,
  })
  image?: Ref<GrpcImage>;

  @OneToOne({
    entity: 'VideoEntity',
    mappedBy: 'file',
    cascade: [Cascade.REMOVE],
    orphanRemoval: true,
    nullable: true,
    ref: true,
  })
  video?: Ref<GrpcVideo>;

  @OneToOne({
    entity: 'StorageObjectEntity',
    mappedBy: 'file',
    cascade: [Cascade.REMOVE],
    orphanRemoval: true,
    nullable: true,
    ref: true,
  })
  storageObject?: Ref<GrpcStorageObject>;
}
