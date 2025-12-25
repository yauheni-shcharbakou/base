import { DatabaseEntity } from '@backend/common';
import { Document } from 'mongoose';

export abstract class MongoEntity extends Document implements DatabaseEntity {
  // @ts-ignore
  readonly _id: string;
  createdAt: Date;
  updatedAt?: Date;
}
