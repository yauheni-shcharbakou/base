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

export interface DatabaseRepository<
  Entity extends GrpcEntityWithTimestamps = GrpcEntityWithTimestamps,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
  Create = CreateOf<Entity>,
  Update = UpdateOf<Entity>,
  Options extends OptionsOf<Entity> = OptionsOf<Entity>,
> {
  isExistsById(id: string, options?: Partial<Options>): Promise<boolean>;
  isExists(query?: Partial<Query>, options?: Partial<Options>): Promise<boolean>;
  count(query?: Partial<Query>, options?: Partial<Options>): Promise<number>;
  getById(id: string, options?: Partial<Options>): Promise<Either<NotFoundException, Entity>>;
  getOne(
    query?: Partial<Query>,
    options?: Partial<Options>,
  ): Promise<Either<NotFoundException, Entity>>;
  getMany(query?: Partial<Query>, options?: Partial<Options>): Promise<Entity[]>;
  getList<E = Entity>(
    request: DatabaseRepositoryGetList<Query>,
    options?: Partial<Options>,
  ): Promise<DatabaseRepositoryGetListRes<E>>;
  saveOne(createData: Create, options?: Partial<Options>): Promise<Either<Error, Entity>>;
  saveMany(createData: Create[], options?: Partial<Options>): Promise<Either<Error, Entity[]>>;
  updateById(
    id: string,
    updateData: Update,
    options?: Partial<Options>,
  ): Promise<Either<NotFoundException, Entity>>;
  updateOne(
    query: Partial<Query>,
    updateData: Update,
    options?: Partial<Options>,
  ): Promise<Either<NotFoundException, Entity>>;
  updateMany(
    query: Partial<Query>,
    updateData: Update,
    options?: Partial<Options>,
  ): Promise<boolean>;
  deleteById(id: string, options?: Partial<Options>): Promise<Either<NotFoundException, Entity>>;
  deleteOne(
    query?: Partial<Query>,
    options?: Partial<Options>,
  ): Promise<Either<NotFoundException, Entity>>;
  deleteMany(query?: Partial<Query>, options?: Partial<Options>): Promise<boolean>;
}
