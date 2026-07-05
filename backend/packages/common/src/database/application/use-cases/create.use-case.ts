import { CreateOf, DatabaseRepository } from '@/database/domain';
import { NestCommon } from '@backend/proto';
import { Either } from '@sweet-monads/either';

export abstract class CreateUseCase<
  Entity extends NestCommon.Entity,
  Create = CreateOf<Entity>,
  Repository extends DatabaseRepository<Entity, any, Create, any> = DatabaseRepository<
    Entity,
    any,
    Create,
    any
  >,
> {
  protected constructor(protected readonly repository: Repository) {}

  createOne(createData: Create): Promise<Either<Error, Entity>> {
    return this.repository.saveOne(createData);
  }

  createMany(createData: Create[]): Promise<Either<Error, Entity[]>> {
    return this.repository.saveMany(createData);
  }
}
