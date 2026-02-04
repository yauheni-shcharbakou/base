import { MongoEntity, MongoSchema, StringProp } from '@backend/persistence';
import { SchemaFactory } from '@nestjs/mongoose';
import { AuthDatabaseCollection } from '@packages/common';
import { GrpcUserRole } from '@backend/grpc';
import { User } from 'common/interfaces/user.interface';

@MongoSchema({ collection: AuthDatabaseCollection.USER })
export class UserEntity extends MongoEntity implements User {
  @StringProp({ required: true, unique: true, index: true })
  email: string;

  @StringProp({
    required: false,
    enum: GrpcUserRole,
    default: () => GrpcUserRole.USER,
    index: true,
  })
  role: GrpcUserRole;

  @StringProp({ required: true })
  hash: string;
}

export const UserSchema = SchemaFactory.createForClass(UserEntity);
