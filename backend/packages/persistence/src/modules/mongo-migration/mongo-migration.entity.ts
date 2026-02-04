import { SchemaFactory } from '@nestjs/mongoose';
import { CommonDatabaseCollection, MigrationStatus } from '@packages/common';
import { MongoSchema, StringProp } from 'decorators';
import { MongoEntity } from 'entities';

@MongoSchema({ collection: CommonDatabaseCollection.MIGRATION })
export class MongoMigrationEntity extends MongoEntity {
  @StringProp({ required: true, unique: true, index: true })
  name: string;

  @StringProp({ required: true, enum: MigrationStatus, index: true })
  status: MigrationStatus;

  @StringProp({ required: false })
  errorMessage?: string;

  @StringProp({ required: false })
  errorStack?: string;
}

export const MongoMigrationSchema = SchemaFactory.createForClass(MongoMigrationEntity);
