import { DatabaseRepository, QueryOf, UpdateOf } from '@/database/domain';
import { NestCommon } from '@backend/proto';
import { NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

export abstract class UpdateUseCase<
  Entity extends NestCommon.Entity,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
  Update = UpdateOf<Entity>,
  Repository extends DatabaseRepository<Entity, Query, any, Update> = DatabaseRepository<
    Entity,
    Query,
    any,
    Update
  >,
> {
  protected constructor(protected readonly repository: Repository) {}

  updateById(id: string, updateData: Update): Promise<Either<NotFoundException, Entity>> {
    return this.repository.updateById(id, updateData);
  }

  updateOne(query: Partial<Query>, updateData: Update): Promise<Either<NotFoundException, Entity>> {
    return this.repository.updateOne(query, updateData);
  }

  updateMany(query: Partial<Query>, updateData: Update): Promise<boolean> {
    return this.repository.updateMany(query, updateData);
  }
}
