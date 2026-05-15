import { NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
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

export type JoinField<Entity extends NestCommon.Entity> = keyof Entity | string;

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

export interface DatabaseRepository<
  Entity extends NestCommon.Entity = NestCommon.Entity,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
  Create = CreateOf<Entity>,
  Update = UpdateOf<Entity>,
> {
  isExistsById(id: string): Promise<boolean>;
  isExists(query?: Partial<Query>): Promise<boolean>;
  count(query?: Partial<Query>): Promise<number>;
  distinct<Field extends keyof Entity>(
    field: Field,
    query?: Partial<Query>,
  ): Promise<Set<Entity[Field]>>;
  getById<E extends NestCommon.Entity = Entity>(
    id: string,
    options?: OptionsOf<E>,
  ): Promise<Either<NotFoundException, E>>;
  getOne<E extends NestCommon.Entity = Entity>(
    query?: Partial<Query>,
    options?: OptionsOf<E>,
  ): Promise<Either<NotFoundException, E>>;
  getMany<E extends NestCommon.Entity = Entity>(
    query?: Partial<Query>,
    options?: OptionsOf<E>,
  ): Promise<E[]>;
  getList<E extends NestCommon.Entity = Entity>(
    request: DatabaseRepositoryGetList<Query>,
    options?: OptionsOf<E>,
  ): Promise<DatabaseRepositoryGetListRes<E>>;
  saveOne(createData: Create): Promise<Either<Error, Entity>>;
  saveMany(createData: Create[]): Promise<Either<Error, Entity[]>>;
  updateById(id: string, updateData: Update): Promise<Either<NotFoundException, Entity>>;
  updateOne(query: Partial<Query>, updateData: Update): Promise<Either<NotFoundException, Entity>>;
  updateMany(query: Partial<Query>, updateData: Update): Promise<boolean>;
  deleteById(id: string): Promise<Either<NotFoundException, Entity>>;
  deleteOne(query?: Partial<Query>): Promise<Either<NotFoundException, Entity>>;
  deleteMany(query?: Partial<Query>): Promise<boolean>;

  bulkUpdate(updates: BulkUpdate<Entity>[]): Promise<Either<Error, boolean>>;
}
