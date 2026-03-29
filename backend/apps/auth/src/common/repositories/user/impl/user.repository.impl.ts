import { PostgresRepositoryImpl } from '@backend/persistence';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { NotFoundException } from '@nestjs/common';
import { GrpcUser, GrpcUserQuery } from '@backend/grpc';
import { Either, left, right } from '@sweet-monads/either';
import { UserEntity } from 'common/repositories/user/entities/user.entity';
import { User } from 'common/interfaces/user.interface';
import { UserMapper } from 'common/repositories/user/mappers/user.mapper';
import { UserCreate, UserRepository, UserUpdate } from 'common/repositories/user/user.repository';

export class UserRepositoryImpl
  extends PostgresRepositoryImpl<UserEntity, GrpcUser, GrpcUserQuery, UserCreate, UserUpdate>
  implements UserRepository
{
  constructor(
    @InjectRepository(UserEntity) protected readonly repository: EntityRepository<UserEntity>,
  ) {
    super(repository, new UserMapper());
  }

  async getOneInternal(query?: Partial<GrpcUserQuery>): Promise<Either<NotFoundException, User>> {
    const entity = await this.repository.findOne(this.mapper.transformQuery(query));

    if (!entity) {
      return left(new NotFoundException(`${this.repository.getEntityName()} not found`));
    }

    return right(entity);
  }
}
