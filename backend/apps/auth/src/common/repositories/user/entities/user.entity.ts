import { PostgresEntity, PostgresProp, PostgresSchema } from '@backend/persistence';
import { Property } from '@mikro-orm/core';
import { AuthDatabaseEntity } from '@packages/common';
import { GrpcUserRole } from '@backend/grpc';
import { User } from 'common/interfaces/user.interface';

@PostgresSchema({ tableName: AuthDatabaseEntity.USER })
export class UserEntity extends PostgresEntity implements User {
  @Property({ unique: true, index: true })
  email: string;

  @PostgresProp.Enum({
    enum: GrpcUserRole,
    default: GrpcUserRole.USER,
    index: true,
  })
  role: GrpcUserRole;

  @Property()
  hash: string;
}
