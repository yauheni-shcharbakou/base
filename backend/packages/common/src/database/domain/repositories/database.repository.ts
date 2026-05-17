import type { NestCommon } from '@backend/proto';
import { NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

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

export abstract class DatabaseRepository<
  Entity extends NestCommon.Entity = NestCommon.Entity,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
  Create = CreateOf<Entity>,
  Update = UpdateOf<Entity>,
> {
  abstract isExistsById(id: string): Promise<boolean>;
  abstract isExists(query?: Partial<Query>): Promise<boolean>;
  abstract count(query?: Partial<Query>): Promise<number>;
  abstract distinct<Field extends keyof Entity>(
    field: Field,
    query?: Partial<Query>,
  ): Promise<Set<Entity[Field]>>;
  abstract getById<E extends NestCommon.Entity = Entity>(
    id: string,
    options?: OptionsOf<E>,
  ): Promise<Either<NotFoundException, E>>;
  abstract getOne<E extends NestCommon.Entity = Entity>(
    query?: Partial<Query>,
    options?: OptionsOf<E>,
  ): Promise<Either<NotFoundException, E>>;
  abstract getMany<E extends NestCommon.Entity = Entity>(
    query?: Partial<Query>,
    options?: OptionsOf<E>,
  ): Promise<E[]>;
  abstract getList<E extends NestCommon.Entity = Entity>(
    request: DatabaseRepositoryGetList<Query>,
    options?: OptionsOf<E>,
  ): Promise<DatabaseRepositoryGetListRes<E>>;
  abstract saveOne(createData: Create): Promise<Either<Error, Entity>>;
  abstract saveMany(createData: Create[]): Promise<Either<Error, Entity[]>>;
  abstract updateById(id: string, updateData: Update): Promise<Either<NotFoundException, Entity>>;
  abstract updateOne(
    query: Partial<Query>,
    updateData: Update,
  ): Promise<Either<NotFoundException, Entity>>;
  abstract updateMany(query: Partial<Query>, updateData: Update): Promise<boolean>;
  abstract deleteById(id: string): Promise<Either<NotFoundException, Entity>>;
  abstract deleteOne(query?: Partial<Query>): Promise<Either<NotFoundException, Entity>>;
  abstract deleteMany(query?: Partial<Query>): Promise<boolean>;

  abstract bulkUpdate(updates: BulkUpdate<Entity>[]): Promise<Either<Error, boolean>>;
}
