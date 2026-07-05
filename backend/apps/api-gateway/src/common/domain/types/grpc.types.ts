import { NestCommon } from '@backend/proto';

export interface ItemsType<Item> {
  items: Item[];
}

export interface RequestType<Query> {
  query: Query;
}

export interface UpdateType<Query, Update> {
  query: Query;
  update: Update;
}

export interface UpdateByIdType<Update> extends NestCommon.IdField {
  update: Update;
}
