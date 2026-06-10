import { PgEntity, PgProp, PgSchema } from '@backend/pg';
import { NestAuth } from '@backend/proto';
import { Ref } from '@mikro-orm/core';
import { ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { PgUserEntity } from '@modules/user/infrastructure/pg/entities/pg.user.entity';
import { AuthDatabaseEntity } from '@packages/common';

@PgSchema({ tableName: AuthDatabaseEntity.TEMP_CODE })
export class PgTempCodeEntity extends PgEntity implements NestAuth.TempCode {
  @ManyToOne({
    entity: () => PgUserEntity,
    ref: true,
    index: true,
    deleteRule: 'cascade',
  })
  user: Ref<NestAuth.User>;

  @Property({ persist: false })
  get userId() {
    return this.user.id;
  }

  @Property()
  code: string;

  @Property()
  isActive: boolean;

  @PgProp.Date({ index: true })
  expiredAt: Date;
}
