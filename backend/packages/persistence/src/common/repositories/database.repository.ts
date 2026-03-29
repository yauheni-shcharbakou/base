import { NotFoundException } from '@nestjs/common';
import { GrpcBaseQuery, GrpcEntityWithTimestamps, GrpcGetListRequest } from '@backend/grpc';
import { Either } from '@sweet-monads/either';

export type ExcludeDatabaseSystemFields<Entity> = Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>;

export type QueryOf<Entity> = Partial<GrpcBaseQuery & Omit<Entity, 'id'>>;

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

export interface DatabaseRepositoryGetList<Query> extends Partial<GrpcGetListRequest> {
  query?: Partial<Query>;
}

export interface DatabaseRepositoryGetListRes<Entity> {
  items: Entity[];
  total: number;
}

export type JoinField<Entity extends GrpcEntityWithTimestamps> = keyof Entity | string;

export type OptionsOf<Entity extends GrpcEntityWithTimestamps> = {
  populate?: JoinField<Entity>[];
};

export type BulkUpdate<Entity extends GrpcEntityWithTimestamps> = {
  filter: {
    key: keyof Entity | string;
    value: any;
  };
  update: UpdateOf<Entity>;
};

export interface DatabaseRepository<
  Entity extends GrpcEntityWithTimestamps = GrpcEntityWithTimestamps,
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
  getById<E extends GrpcEntityWithTimestamps = Entity>(
    id: string,
    options?: OptionsOf<E>,
  ): Promise<Either<NotFoundException, E>>;
  getOne<E extends GrpcEntityWithTimestamps = Entity>(
    query?: Partial<Query>,
    options?: OptionsOf<E>,
  ): Promise<Either<NotFoundException, E>>;
  getMany<E extends GrpcEntityWithTimestamps = Entity>(
    query?: Partial<Query>,
    options?: OptionsOf<E>,
  ): Promise<E[]>;
  getList<E extends GrpcEntityWithTimestamps = Entity>(
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
