import { CrudSort } from '@backend/grpc';

export type MongoSort = {
  [field: string]: CrudSort | 1 | -1;
};
