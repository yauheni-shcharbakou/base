import { PostgresSchema, PostgresEntity, PostgresProp } from '@/common';
import { MigrationStatus } from '@backend/common';
import { Property } from '@mikro-orm/decorators/legacy';
import { CommonDatabaseEntity } from '@packages/common';

@PostgresSchema({ tableName: CommonDatabaseEntity.MIGRATION })
export class PostgresMigrationEntity extends PostgresEntity {
  @Property({ type: 'string', index: true, unique: true })
  name: string;

  @PostgresProp.Enum({ enum: MigrationStatus, index: true })
  status: MigrationStatus;

  @Property({ type: 'string', nullable: true })
  errorMessage?: string;

  @Property({ type: 'string', nullable: true })
  errorStack?: string;
}
