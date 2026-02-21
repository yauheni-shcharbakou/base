import { MongoEntity, MongoProp, MongoSchema } from '@backend/persistence';
import { AuthDatabaseEntity } from '@packages/common';
import { GrpcUserRole } from '@backend/grpc';
import { User } from 'common/interfaces/user.interface';

@MongoSchema({ collection: AuthDatabaseEntity.USER })
export class UserEntity extends MongoEntity implements User {
  @MongoProp.String({ required: true, unique: true, index: true })
  email: string;

  @MongoProp.String({
    required: false,
    enum: GrpcUserRole,
    default: () => GrpcUserRole.USER,
    index: true,
  })
  role: GrpcUserRole;

  @MongoProp.String({ required: true })
  hash: string;
}
