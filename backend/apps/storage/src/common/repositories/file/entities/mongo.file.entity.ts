import { MongoEntity, MongoProp, MongoSchema } from '@backend/persistence';
import { StorageDatabaseEntity } from '@packages/common';
import { GrpcFile, GrpcFileUploadStatus } from '@backend/grpc';

@MongoSchema({ collection: StorageDatabaseEntity.FILE })
export class MongoFileEntity extends MongoEntity implements GrpcFile {
  @MongoProp.Id({ required: true, index: true })
  user: string;

  @MongoProp.String({ required: true })
  originalName: string;

  @MongoProp.Number({ required: true })
  size: number;

  @MongoProp.String({ required: true })
  mimeType: string;

  @MongoProp.String({ required: true, index: true })
  extension: string;

  @MongoProp.String({
    required: false,
    index: true,
    enum: GrpcFileUploadStatus,
    default: () => GrpcFileUploadStatus.PENDING,
  })
  uploadStatus: GrpcFileUploadStatus;
}
