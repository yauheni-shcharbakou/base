import { PostgresEntity, PostgresProp, PostgresSchema } from '@backend/persistence';
import { Ref } from '@mikro-orm/core';
import { ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { AuthDatabaseEntity } from '@packages/common';
import { GrpcTempCode, GrpcUser } from '@backend/grpc';
import { UserEntity } from 'common/repositories/user/entities/user.entity';

@PostgresSchema({ tableName: AuthDatabaseEntity.TEMP_CODE })
export class TempCodeEntity extends PostgresEntity implements GrpcTempCode {
  @ManyToOne({
    entity: () => UserEntity,
    ref: true,
    index: true,
    deleteRule: 'cascade',
  })
  user: Ref<GrpcUser>;

  @Property({ persist: false })
  get userId() {
    return this.user.id;
  }

  @Property()
  code: string;

  @Property()
  isActive: boolean;

  @PostgresProp.Date({ index: true })
  expiredAt: Date;
}
