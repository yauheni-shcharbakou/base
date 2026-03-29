import { GrpcEntityWithTimestamps } from '@backend/grpc';
import { Document } from 'mongoose';

export abstract class MongoEntity extends Document implements GrpcEntityWithTimestamps {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  readonly _id: string;
  readonly id: string;
  createdAt: Date;
  updatedAt?: Date;
}
