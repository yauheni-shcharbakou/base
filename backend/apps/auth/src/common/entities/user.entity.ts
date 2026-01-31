import { MongoEntity, MongoSchema, StringProp } from '@backend/persistence';
import { SchemaFactory } from '@nestjs/mongoose';
import { AuthDatabaseCollection } from '@packages/common';
import { UserRole } from '@backend/grpc';
import { UserInternal } from 'common/interfaces/user.interface';

@MongoSchema({ collection: AuthDatabaseCollection.USER })
export class UserEntity extends MongoEntity implements UserInternal {
  @StringProp({ required: true, unique: true, index: true })
  email: string;

  @StringProp({ required: false, enum: UserRole, default: () => UserRole.USER, index: true })
  role: UserRole;

  @StringProp({ required: true })
  hash: string;
}

export const UserSchema = SchemaFactory.createForClass(UserEntity);
