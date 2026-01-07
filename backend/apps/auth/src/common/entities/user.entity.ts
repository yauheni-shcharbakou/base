import { DateProp, MongoEntity, MongoSchema, NumberProp, StringProp } from '@backend/persistence';
import { Prop, SchemaFactory } from '@nestjs/mongoose';
import { MainDatabaseCollection } from '@packages/common';
import { UserRole } from '@packages/grpc.nest';
import { UserInternal, UserSession } from 'common/interfaces/user.interface';

@MongoSchema({ _id: false, timestamps: false })
export class UserSessionSchema implements UserSession {
  @StringProp()
  id: string;

  @DateProp()
  createdAt: Date;

  @DateProp()
  expiresAt: Date;
}

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

  @Prop({ required: false, type: [UserSessionSchema], default: () => [] })
  sessions: UserSessionSchema[];
}

export const UserSchema = SchemaFactory.createForClass(UserEntity);
