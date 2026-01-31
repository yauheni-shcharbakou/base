import { MongoRepositoryImpl } from '@backend/persistence';
import { NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserQuery } from '@backend/grpc';
import { Either, left, right } from '@sweet-monads/either';
import { UserEntity } from 'common/entities/user.entity';
import { UserInternal } from 'common/interfaces/user.interface';
import { UserMapper } from 'common/repositories/user/mappers/user.mapper';
import {
  UserCreateInternal,
  UserRepository,
  UserUpdateInternal,
} from 'common/repositories/user/user.repository';
import { Model } from 'mongoose';

export class UserRepositoryImpl
  extends MongoRepositoryImpl<UserEntity, User, UserQuery, UserCreateInternal, UserUpdateInternal>
  implements UserRepository
{
  constructor(@InjectModel(UserEntity.name) protected readonly model: Model<UserEntity>) {
    super(model, new UserMapper());
  }

  async getOneInternal(
    query?: Partial<UserQuery>,
  ): Promise<Either<NotFoundException, UserInternal>> {
    const entity = await this.model.findOne<UserEntity>(this.mapper.transformQuery(query)).exec();

    if (!entity) {
      return left(new NotFoundException(`${this.model.modelName} not found`));
    }

    return right(entity.toJSON({ flattenMaps: false }));
  }
}
