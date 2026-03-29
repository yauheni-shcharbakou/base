import { PostgresEntity, PostgresProp, PostgresSchema } from '@backend/persistence';
import { Collection, OneToMany, Property } from '@mikro-orm/core';
import { AuthDatabaseEntity } from '@packages/common';
import { GrpcTempCode, GrpcUserRole } from '@backend/grpc';
import { User } from 'common/interfaces/user.interface';

@PostgresSchema({ tableName: AuthDatabaseEntity.USER })
export class UserEntity extends PostgresEntity<'tempTokens'> implements User {
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

  @OneToMany({
    entity: 'TempCodeEntity',
    mappedBy: 'user',
  })
  tempTokens = new Collection<GrpcTempCode>(this);
}
