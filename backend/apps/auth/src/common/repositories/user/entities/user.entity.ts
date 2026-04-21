import { PostgresEntity, PostgresProp, PostgresSchema } from '@backend/persistence';
import { Collection } from '@mikro-orm/core';
import { OneToMany, Property } from '@mikro-orm/decorators/legacy';
import { AuthDatabaseEntity } from '@packages/common';
import { GrpcTempCode, GrpcUserRole } from '@backend/grpc';
import { User } from 'common/interfaces/user.interface';
import { TempCodeEntity } from 'common/repositories/temp-code/entities/temp-code.entity';

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
    entity: () => TempCodeEntity,
    mappedBy: 'user',
  })
  tempTokens = new Collection<GrpcTempCode>(this);
}
