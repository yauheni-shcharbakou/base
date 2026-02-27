import { MongoEntity, MongoProp, MongoSchema } from '@backend/persistence';
import { StorageDatabaseEntity } from '@packages/common';
import { GrpcImage } from '@backend/grpc';

@MongoSchema({ collection: StorageDatabaseEntity.IMAGE })
export class MongoImageEntity extends MongoEntity implements GrpcImage {
  @MongoProp.Id({ required: true, index: true })
  user: string;

  @MongoProp.Id({ required: true, index: true, ref: StorageDatabaseEntity.FILE, unique: true })
  file: string;

  @MongoProp.Number({ required: true })
  width: number;

  @MongoProp.Number({ required: true })
  height: number;

  @MongoProp.String({ required: true })
  alt: string;
}
