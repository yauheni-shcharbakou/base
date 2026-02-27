import { GrpcEntityWithTimestamps } from '@backend/grpc';
import { Document } from 'mongoose';

export abstract class MongoEntity extends Document implements GrpcEntityWithTimestamps {
  // @ts-ignore
  readonly _id: string;
  readonly id: string;
  createdAt: Date;
  updatedAt?: Date;
}
