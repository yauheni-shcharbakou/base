import { MongoRepositoryImpl } from '@backend/persistence';
import { NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { GrpcUser, GrpcUserQuery } from '@backend/grpc';
import { AuthDatabaseEntity } from '@packages/common';
import { Either, left, right } from '@sweet-monads/either';
import { UserEntity } from 'common/repositories/user/entities/user.entity';
import { User } from 'common/interfaces/user.interface';
import { UserMapper } from 'common/repositories/user/mappers/user.mapper';
import { UserCreate, UserRepository, UserUpdate } from 'common/repositories/user/user.repository';
import { Model } from 'mongoose';

export class UserRepositoryImpl
  extends MongoRepositoryImpl<UserEntity, GrpcUser, GrpcUserQuery, UserCreate, UserUpdate>
  implements UserRepository
{
  constructor(@InjectModel(AuthDatabaseEntity.USER) protected readonly model: Model<UserEntity>) {
    super(model, new UserMapper());
  }

  async getOneInternal(query?: Partial<GrpcUserQuery>): Promise<Either<NotFoundException, User>> {
    const entity = await this.model.findOne<UserEntity>(this.mapper.transformQuery(query)).exec();

    if (!entity) {
      return left(new NotFoundException(`${this.model.modelName} not found`));
    }

    return right(entity.toJSON({ flattenMaps: false }));
  }
}
