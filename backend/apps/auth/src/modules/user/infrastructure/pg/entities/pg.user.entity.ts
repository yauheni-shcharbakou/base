import { PgEntity, PgProp, PgSchema } from '@backend/pg';
import { NestAuth } from '@backend/proto';
import { Collection } from '@mikro-orm/core';
import { OneToMany, Property } from '@mikro-orm/decorators/legacy';
import { PgTempCodeEntity } from '@modules/temp-code/infrastructure/pg/entities/pg.temp-code.entity';
import { User } from '@modules/user/domain/interfaces/user.interface';
import { AuthDatabaseEntity } from '@packages/common';

@PgSchema({ tableName: AuthDatabaseEntity.USER })
export class PgUserEntity extends PgEntity<'tempCodes'> implements User {
  @Property({ unique: true, index: true })
  email: string;

  @PgProp.Enum({
    enum: NestAuth.UserRole,
    default: NestAuth.UserRole.USER,
    index: true,
  })
  role: NestAuth.UserRole;

  @Property()
  hash: string;

  @OneToMany({
    entity: () => PgTempCodeEntity,
    mappedBy: 'user',
  })
  tempCodes = new Collection<NestAuth.TempCode>(this);
}
