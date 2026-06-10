import { PgRepositoryImpl } from '@backend/pg';
import { NestAuth } from '@backend/proto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { User } from '@modules/user/domain/interfaces/user.interface';
import {
  UserCreate,
  UserRepository,
  UserUpdate,
} from '@modules/user/domain/repositories/user.repository';
import { NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { PgUserEntity } from '../entities/pg.user.entity';
import { PgUserMapper } from '../mappers/pg.user.mapper';

export class PgUserRepositoryImpl
  extends PgRepositoryImpl<PgUserEntity, NestAuth.User, NestAuth.UserQuery, UserCreate, UserUpdate>
  implements UserRepository
{
  constructor(
    @InjectRepository(PgUserEntity) protected readonly repository: EntityRepository<PgUserEntity>,
  ) {
    super(repository, new PgUserMapper());
  }

  async getOneInternal(
    query?: Partial<NestAuth.UserQuery>,
  ): Promise<Either<NotFoundException, User>> {
    const entity = await this.repository.findOne(this.mapper.transformQuery(query));

    if (!entity) {
      return left(new NotFoundException(`${this.repository.getEntityName()} not found`));
    }

    return right(entity);
  }
}
