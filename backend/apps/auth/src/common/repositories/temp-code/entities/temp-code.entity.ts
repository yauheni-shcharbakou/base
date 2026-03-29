import { PostgresEntity, PostgresProp, PostgresSchema } from '@backend/persistence';
import { ManyToOne, Property, Ref } from '@mikro-orm/core';
import { AuthDatabaseEntity } from '@packages/common';
import { GrpcTempCode, GrpcUser } from '@backend/grpc';

@PostgresSchema({ tableName: AuthDatabaseEntity.TEMP_CODE })
export class TempCodeEntity extends PostgresEntity implements GrpcTempCode {
  @ManyToOne({
    entity: 'UserEntity',
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
