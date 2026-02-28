import { GrpcEntityWithTimestamps } from '@backend/grpc';
import { NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import {
  CreateOf,
  DatabaseRepositoryGetList,
  DatabaseRepositoryGetListRes,
  JoinField,
  QueryOf,
  UpdateOf,
} from 'common/repositories';

export interface CrudService<
  Entity extends GrpcEntityWithTimestamps = GrpcEntityWithTimestamps,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
  Create = CreateOf<Entity>,
  Update = UpdateOf<Entity>,
> {
  getById(id: string): Promise<Either<NotFoundException, Entity>>;
  getOne(query?: Query): Promise<Either<NotFoundException, Entity>>;
  getMany(query?: Query): Promise<Entity[]>;
  getList<E = Entity>(
    request: DatabaseRepositoryGetList<Query>,
    populate?: JoinField<Entity>[],
  ): Promise<DatabaseRepositoryGetListRes<E>>;
  saveOne(createData: Create): Promise<Either<Error, Entity>>;
  updateById(id: string, updateData: Update): Promise<Either<NotFoundException, Entity>>;
  deleteById(id: string): Promise<Either<NotFoundException, Entity>>;
}
