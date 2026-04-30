import type { NestCommon } from '@backend/proto';

export type MongoSort = {
  [field: string]: NestCommon.CrudSort | 1 | -1;
};
