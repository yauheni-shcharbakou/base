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

  protected afterSingleUpdate(result: Either<NotFoundException, Entity>): void | Promise<void> {}

  async updateById(id: string, updateData: Update): Promise<Either<NotFoundException, Entity>> {
    const result = await this.repository.updateById(id, updateData);
    await this.afterSingleUpdate(result);
    return result;
  }

  async updateOne(
    query: Partial<Query>,
    updateData: Update,
  ): Promise<Either<NotFoundException, Entity>> {
    const result = await this.repository.updateOne(query, updateData);
    await this.afterSingleUpdate(result);
    return result;
  }

  updateMany(query: Partial<Query>, updateData: Update): Promise<boolean> {
    return this.repository.updateMany(query, updateData);
  }
}
