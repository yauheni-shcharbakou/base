import { GrpcEntityWithTimestamps } from '@backend/grpc';
import { NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import {
  CreateOf,
  DatabaseRepositoryGetList,
  DatabaseRepositoryGetListRes,
  OptionsOf,
  QueryOf,
  UpdateOf,
} from 'common/repositories';

export interface CrudService<
  Entity extends GrpcEntityWithTimestamps = GrpcEntityWithTimestamps,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
  Create = CreateOf<Entity>,
  Update = UpdateOf<Entity>,
> {
  getById<E extends GrpcEntityWithTimestamps = Entity>(
    id: string,
    options?: OptionsOf<E>,
  ): Promise<Either<NotFoundException, E>>;
  getOne<E extends GrpcEntityWithTimestamps = Entity>(
    query?: Query,
    options?: OptionsOf<E>,
  ): Promise<Either<NotFoundException, E>>;
  getMany<E extends GrpcEntityWithTimestamps = Entity>(
    query?: Query,
    options?: OptionsOf<E>,
  ): Promise<E[]>;
  getList<E extends GrpcEntityWithTimestamps = Entity>(
    request: DatabaseRepositoryGetList<Query>,
    options?: OptionsOf<E>,
  ): Promise<DatabaseRepositoryGetListRes<E>>;
  saveOne(createData: Create): Promise<Either<Error, Entity>>;
  updateById(id: string, updateData: Update): Promise<Either<NotFoundException, Entity>>;
  deleteById(id: string): Promise<Either<NotFoundException, Entity>>;
}
