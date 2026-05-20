import {
  DatabaseRepository,
  DatabaseRepositoryGetList,
  DatabaseRepositoryGetListRes,
  OptionsOf,
  QueryOf,
} from '@/database/domain';
import { NestCommon } from '@backend/proto';
import { NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

export abstract class GetUseCase<
  Entity extends NestCommon.Entity,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
  Repository extends DatabaseRepository<Entity, Query> = DatabaseRepository<Entity, Query>,
> {
  protected constructor(protected readonly repository: Repository) {}

  getById<E extends NestCommon.Entity = Entity>(
    id: string,
    options?: OptionsOf<E>,
  ): Promise<Either<NotFoundException, E>> {
    return this.repository.getById<E>(id, options);
  }

  getOne<E extends NestCommon.Entity = Entity>(
    query: Partial<Query>,
    options?: OptionsOf<E>,
  ): Promise<Either<NotFoundException, E>> {
    return this.repository.getOne<E>(query, options);
  }

  getMany<E extends NestCommon.Entity = Entity>(
    query: Partial<Query>,
    options?: OptionsOf<E>,
  ): Promise<E[]> {
    return this.repository.getMany<E>(query, options);
  }

  getList<E extends NestCommon.Entity = Entity>(
    query: DatabaseRepositoryGetList<Query>,
    options?: OptionsOf<E>,
  ): Promise<DatabaseRepositoryGetListRes<E>> {
    return this.repository.getList<E>(query, options);
  }
}
