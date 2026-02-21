import { SchemaFactory } from '@nestjs/mongoose';
import { CommonDatabaseEntity } from '@packages/common';
import { MigrationStatus } from 'common';
import { MongoProp, MongoSchema } from 'mongo/decorators';
import { MongoEntity } from 'mongo/entities';

@MongoSchema({ collection: CommonDatabaseEntity.MIGRATION })
export class MongoMigrationEntity extends MongoEntity {
  @MongoProp.String({ required: true, unique: true, index: true })
  name: string;

  @MongoProp.String({ required: true, enum: MigrationStatus, index: true })
  status: MigrationStatus;

  @MongoProp.String({ required: false })
  errorMessage?: string;

  @MongoProp.String({ required: false })
  errorStack?: string;
}

export const MongoMigrationSchema = SchemaFactory.createForClass(MongoMigrationEntity);
