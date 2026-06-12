import type { NestCommon } from '@backend/proto';

export type MongoSort = {
  [field: string]: NestCommon.Sort | 1 | -1;
};
