import { MongoEntity, MongoProp, MongoSchema } from '@backend/persistence';
import { StorageDatabaseEntity } from '@packages/common';
import { GrpcStorageObject, GrpcStorageObjectType } from '@backend/grpc';

@MongoSchema({ collection: StorageDatabaseEntity.FILE })
export class MongoStorageObjectEntity extends MongoEntity implements GrpcStorageObject {
  @MongoProp.Id({ required: true, index: true })
  user: string;

  @MongoProp.String({ required: true, index: true })
  name: string;

  @MongoProp.Boolean({ required: false, index: true, default: () => false })
  isPublic: boolean;

  @MongoProp.String({ required: true, index: true, enum: GrpcStorageObjectType })
  type: GrpcStorageObjectType;

  @MongoProp.Id({ required: false, index: true, ref: StorageDatabaseEntity.STORAGE_OBJECT })
  parent?: string;

  @MongoProp.Id({ required: false, index: true, ref: StorageDatabaseEntity.FILE })
  file?: string;

  @MongoProp.String({ required: false })
  folderPath?: string;

  @MongoProp.Id({ required: false, index: true, ref: StorageDatabaseEntity.IMAGE })
  image?: string;

  @MongoProp.Id({ required: false, index: true, ref: StorageDatabaseEntity.VIDEO })
  video?: string;
}
