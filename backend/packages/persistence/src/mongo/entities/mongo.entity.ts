import type { NestCommon } from '@backend/proto';
import { Document } from 'mongoose';

export abstract class MongoEntity extends Document implements NestCommon.EntityWithTimestamps {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  readonly _id: string;
  readonly id: string;
  createdAt: Date;
  updatedAt?: Date;
}
