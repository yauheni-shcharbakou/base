import { PgEntity, PgProp, PgSchema } from '@backend/pg';
import { NestAuth } from '@backend/proto';
import { Ref } from '@mikro-orm/core';
import { ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { AuthSession } from '@modules/auth/domain/interfaces/auth.interface';
import { PgUserEntity } from '@modules/user/infrastructure/pg/entities/pg.user.entity';
import { AuthDatabaseEntity } from '@packages/common';

@PgSchema({ tableName: AuthDatabaseEntity.SESSION })
export class PgAuthSessionEntity extends PgEntity implements AuthSession {
  // A deleted user's sessions go with it: no refresh token outlives its user.
  @ManyToOne({
    entity: () => PgUserEntity,
    ref: true,
    index: true,
    deleteRule: 'cascade',
  })
  user: Ref<NestAuth.User>;

  @Property({ persist: false, type: 'string' })
  get userId() {
    return this.user.id;
  }

  @Property({ unique: true })
  tokenId: string;

  @PgProp.Date({ index: true })
  expiredAt: Date;
}
