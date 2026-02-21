import { GrpcCrudSort } from '@backend/grpc';

export type MongoSort = {
  [field: string]: GrpcCrudSort | 1 | -1;
};
