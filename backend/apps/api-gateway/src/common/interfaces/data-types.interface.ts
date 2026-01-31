import { IdField } from '@backend/grpc';

export interface ItemsType<Item> {
  items: Item[];
}

export interface RequestType<Query> {
  query?: Query;
}

export interface UpdateRequestType<Query, Update> {
  query: Query;
  update: Update;
}

export interface UpdateByIdRequestType<Update> extends IdField {
  update: Update;
}
