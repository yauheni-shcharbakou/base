import type { NestCommon } from '@backend/proto';

export type ExcludeDatabaseSystemFields<Entity> = Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>;

export type QueryOf<Entity> = Partial<NestCommon.Query & Omit<Entity, 'id'>>;

export type CreateOf<Entity> = ExcludeDatabaseSystemFields<Entity>;

export type UpdateSetOf<Entity> = Partial<ExcludeDatabaseSystemFields<Entity>>;

export type UpdateRemoveOf<Entity> = (keyof UpdateSetOf<Entity>)[];

export type UpdateIncOf<Entity> = {
  [Field in keyof UpdateSetOf<Entity> as Entity[Field] extends number
    ? Field
    : never]?: Entity[Field];
};

export type UpdateOf<Entity> = {
  set?: UpdateSetOf<Entity>;
  remove?: UpdateRemoveOf<Entity>;
  inc?: UpdateIncOf<Entity>;
};

export interface DatabaseRepositoryGetList<Query> extends Partial<NestCommon.GetList> {
  query?: Partial<Query>;
}

export interface DatabaseRepositoryGetListRes<Entity> {
  items: Entity[];
  total: number;
}

export type JoinField<Entity extends NestCommon.Entity> = keyof Entity; // | string;

export type OptionsOf<Entity extends NestCommon.Entity> = {
  populate?: JoinField<Entity>[];
};

export type BulkUpdate<Entity extends NestCommon.Entity> = {
  filter: {
    key: keyof Entity | string;
    value: any;
  };
  update: UpdateOf<Entity>;
};
