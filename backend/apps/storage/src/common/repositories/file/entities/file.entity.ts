import {
  GrpcFile,
  GrpcFileUploadStatus,
  GrpcImage,
  GrpcStorageObject,
  GrpcVideo,
} from '@backend/grpc';
import { PostgresEntity, PostgresProp, PostgresSchema } from '@backend/persistence';
import { Cascade, Ref } from '@mikro-orm/core';
import { OneToOne, Property } from '@mikro-orm/decorators/legacy';
import { StorageDatabaseEntity } from '@packages/common';
import { ImageEntity } from 'common/repositories/image/entities/image.entity';
import { StorageObjectEntity } from 'common/repositories/storage-object/entities/storage-object.entity';
import { VideoEntity } from 'common/repositories/video/entities/video.entity';

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
    entity: () => ImageEntity,
    mappedBy: 'file',
    cascade: [Cascade.REMOVE],
    orphanRemoval: true,
    nullable: true,
    ref: true,
  })
  image?: Ref<GrpcImage>;

  @OneToOne({
    entity: () => VideoEntity,
    mappedBy: 'file',
    cascade: [Cascade.REMOVE],
    orphanRemoval: true,
    nullable: true,
    ref: true,
  })
  video?: Ref<GrpcVideo>;

  @OneToOne({
    entity: () => StorageObjectEntity,
    mappedBy: 'file',
    cascade: [Cascade.REMOVE],
    orphanRemoval: true,
    nullable: true,
    ref: true,
  })
  storageObject?: Ref<GrpcStorageObject>;
}
