import type { NestCommon } from '@backend/proto';
import { NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import {
  CreateOf,
  DatabaseRepository,
  DatabaseRepositoryGetList,
  DatabaseRepositoryGetListRes,
  OptionsOf,
  QueryOf,
  UpdateOf,
} from 'common/repositories';
import { CrudService } from 'common/services/crud/crud.service';

export abstract class CrudServiceImpl<
  Entity extends NestCommon.EntityWithTimestamps = NestCommon.EntityWithTimestamps,
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

  getById<E extends NestCommon.EntityWithTimestamps = Entity>(
    id: string,
    options?: OptionsOf<E>,
  ): Promise<Either<NotFoundException, E>> {
    return this.repository.getById(id, options);
  }

  getOne<E extends NestCommon.EntityWithTimestamps = Entity>(
    query?: Query,
    options?: OptionsOf<E>,
  ): Promise<Either<NotFoundException, E>> {
    return this.repository.getOne(query, options);
  }

  getMany<E extends NestCommon.EntityWithTimestamps = Entity>(
    query?: Query,
    options?: OptionsOf<E>,
  ): Promise<E[]> {
    return this.repository.getMany(query, options);
  }

  getList<E extends NestCommon.EntityWithTimestamps = Entity>(
    request: DatabaseRepositoryGetList<Query>,
    options?: OptionsOf<E>,
  ): Promise<DatabaseRepositoryGetListRes<E>> {
    return this.repository.getList(request, options);
  }

  saveOne(createData: Create): Promise<Either<Error, Entity>> {
    return this.repository.saveOne(createData);
  }

  updateById(id: string, updateData: Update): Promise<Either<NotFoundException, Entity>> {
    return this.repository.updateById(id, updateData);
  }
}
