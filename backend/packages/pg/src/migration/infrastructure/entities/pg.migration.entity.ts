import { PgSchema, PgEntity, PgProp } from '@/common';
import { MigrationStatus } from '@backend/common';
import { Property } from '@mikro-orm/decorators/legacy';
import { CommonDatabaseEntity } from '@packages/common';

@PgSchema({ tableName: CommonDatabaseEntity.MIGRATION })
export class PgMigrationEntity extends PgEntity {
  @Property({ type: 'string', index: true, unique: true })
  name: string;

  @PgProp.Enum({ enum: MigrationStatus, index: true })
  status: MigrationStatus;

  @Property({ type: 'string', nullable: true })
  errorMessage?: string;

  @Property({ type: 'string', nullable: true })
  errorStack?: string;
}
