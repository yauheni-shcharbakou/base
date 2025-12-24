import { SchemaFactory } from '@nestjs/mongoose';
import { CommonDatabaseCollection } from '@packages/common';
import { MongoSchema, StringProp } from 'modules/mongo/decorators';
import { MongoMigrationStatus } from 'modules/mongo/enums';
import { MongoEntity } from './mongo.entity';

@MongoSchema({ collection: CommonDatabaseCollection.MIGRATION })
export class MongoMigrationEntity extends MongoEntity {
  @StringProp({ required: true, unique: true, index: true })
  name: string;

  @StringProp({ required: true, enum: MongoMigrationStatus, index: true })
  status: MongoMigrationStatus;

  @StringProp({ required: false })
  errorMessage?: string;

  @StringProp({ required: false })
  errorStack?: string;
}

export const MongoMigrationSchema = SchemaFactory.createForClass(MongoMigrationEntity);
