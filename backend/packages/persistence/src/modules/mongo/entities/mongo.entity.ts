import { DatabaseEntity } from '@backend/common';
import { Document } from 'mongoose';

export abstract class MongoEntity extends Document implements DatabaseEntity {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  readonly _id: string;
  createdAt: Date;
  updatedAt?: Date;
}
