import { MongoEntity, MongoSchema, NumberProp, StringProp } from '@backend/persistence';
import { SchemaFactory } from '@nestjs/mongoose';
import { MainDatabaseCollection } from '@packages/common';
import { UserRole } from '@packages/grpc.nest';
import { UserInternal } from 'common/interfaces/user.interface';

@MongoSchema({ collection: MainDatabaseCollection.USER })
export class UserEntity extends MongoEntity implements UserInternal {
  @StringProp({ required: true, unique: true, index: true })
  email: string;

  @StringProp({ required: false, enum: UserRole, default: () => UserRole.USER, index: true })
  role: UserRole;

  @StringProp({ required: true })
  salt: string;

  @StringProp({ required: true })
  hash: string;

  @NumberProp({ required: false, default: () => 0 })
  loginAttempts: number;
}

export const UserSchema = SchemaFactory.createForClass(UserEntity);
