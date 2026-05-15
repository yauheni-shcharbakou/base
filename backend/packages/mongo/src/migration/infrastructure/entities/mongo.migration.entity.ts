import { SchemaFactory } from '@nestjs/mongoose';
import { CommonDatabaseEntity } from '@packages/common';
import { MongoEntity, MongoProp, MongoSchema } from '@/common';
import { Migration, MigrationStatus } from '@backend/common';

@MongoSchema({ collection: CommonDatabaseEntity.MIGRATION })
export class MongoMigrationEntity extends MongoEntity implements Migration {
  @MongoProp.String({ required: true, unique: true, index: true })
  name: string;

  @MongoProp.String({ required: true, enum: MigrationStatus, index: true })
  status: MigrationStatus;

  @MongoProp.String({ required: false })
  errorMessage?: string;

  @MongoProp.String({ required: false })
  errorStack?: string;
}

export const MongoMigrationSchema = SchemaFactory.createForClass<Migration>(MongoMigrationEntity);
