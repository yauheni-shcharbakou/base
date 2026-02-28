import { GrpcEntityWithTimestamps } from '@backend/grpc';
import { NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import {
  CreateOf,
  DatabaseRepository,
  DatabaseRepositoryGetList,
  DatabaseRepositoryGetListRes,
  JoinField,
  QueryOf,
  UpdateOf,
} from 'common/repositories';
import { CrudService } from 'common/services/crud/crud.service';

export abstract class CrudServiceImpl<
  Entity extends GrpcEntityWithTimestamps = GrpcEntityWithTimestamps,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
  Create = CreateOf<Entity>,
  Update = UpdateOf<Entity>,
  Repository extends DatabaseRepository<Entity, any, any, any> = DatabaseRepository<
    Entity,
    Query,
    Create,
    Update
  >,
> implements CrudService<Entity, Query, Create, Update> {
  protected readonly repository: Repository;

  deleteById(id: string): Promise<Either<NotFoundException, Entity>> {
    return this.repository.deleteById(id);
  }

  getById(id: string): Promise<Either<NotFoundException, Entity>> {
    return this.repository.getById(id);
  }

  getOne(query?: Query): Promise<Either<NotFoundException, Entity>> {
    return this.repository.getOne(query);
  }

  getMany(query?: Query): Promise<Entity[]> {
    return this.repository.getMany(query);
  }

  getList<E = Entity>(
    request: DatabaseRepositoryGetList<Query>,
    populate?: JoinField<Entity>[],
  ): Promise<DatabaseRepositoryGetListRes<E>> {
    return this.repository.getList(request, { populate });
  }

  saveOne(createData: Create): Promise<Either<Error, Entity>> {
    return this.repository.saveOne(createData);
  }

  updateById(id: string, updateData: Update): Promise<Either<NotFoundException, Entity>> {
    return this.repository.updateById(id, updateData);
  }
}
