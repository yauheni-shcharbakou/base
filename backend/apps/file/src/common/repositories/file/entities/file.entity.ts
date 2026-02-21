import { MongoEntity, MongoProp, MongoSchema } from '@backend/persistence';
import { FileDatabaseEntity } from '@packages/common';
import { GrpcFile, GrpcFileType } from '@backend/grpc';

@MongoSchema({ collection: FileDatabaseEntity.FILE })
export class FileEntity extends MongoEntity implements GrpcFile {
  @MongoProp.Id({ required: true, index: true })
  user: string;

  @MongoProp.String({ required: true, index: true })
  name: string;

  @MongoProp.String({ required: true })
  originalName: string;

  @MongoProp.Number({ required: true })
  size: number;

  @MongoProp.String({ required: true })
  mimeType: string;

  @MongoProp.Boolean({ required: false, index: true, default: () => false })
  isPublic: boolean;

  @MongoProp.String({ required: true, index: true, enum: GrpcFileType })
  type: GrpcFileType;

  @MongoProp.String({ required: true, index: true })
  extension: string;
}
