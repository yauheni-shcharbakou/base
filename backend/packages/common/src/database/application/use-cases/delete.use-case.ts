import { DatabaseRepository, QueryOf } from '@/database/domain';
import { NestCommon } from '@backend/proto';
import { NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

export abstract class DeleteUseCase<
  Entity extends NestCommon.Entity,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
  Repository extends DatabaseRepository<Entity, Query, any, any> = DatabaseRepository<
    Entity,
    Query,
    any,
    any
  >,
> {
  protected constructor(protected readonly repository: Repository) {}

  protected afterSingleDeletion(result: Either<NotFoundException, Entity>): void | Promise<void> {}

  async deleteById(id: string): Promise<Either<NotFoundException, Entity>> {
    const result = await this.repository.deleteById(id);
    await this.afterSingleDeletion(result);
    return result;
  }

  async deleteOne(query: Partial<Query>): Promise<Either<NotFoundException, Entity>> {
    const result = await this.repository.deleteOne(query);
    await this.afterSingleDeletion(result);
    return result;
  }

  deleteMany(query: Partial<Query>): Promise<boolean> {
    return this.repository.deleteMany(query);
  }
}
