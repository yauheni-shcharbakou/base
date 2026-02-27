import { MongoRepositoryImpl } from '@backend/persistence';
import { NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { GrpcUser, GrpcUserQuery } from '@backend/grpc';
import { AuthDatabaseEntity } from '@packages/common';
import { Either, left, right } from '@sweet-monads/either';
import { MongoUserEntity } from 'common/repositories/user/entities/mongo.user.entity';
import { User } from 'common/interfaces/user.interface';
import { MongoUserMapper } from 'common/repositories/user/mappers/mongo.user.mapper';
import { UserCreate, UserRepository, UserUpdate } from 'common/repositories/user/user.repository';
import { Model } from 'mongoose';

export class MongoUserRepositoryImpl
  extends MongoRepositoryImpl<MongoUserEntity, GrpcUser, GrpcUserQuery, UserCreate, UserUpdate>
  implements UserRepository
{
  constructor(
    @InjectModel(AuthDatabaseEntity.USER) protected readonly model: Model<MongoUserEntity>,
  ) {
    super(model, new MongoUserMapper());
  }

  async getOneInternal(query?: Partial<GrpcUserQuery>): Promise<Either<NotFoundException, User>> {
    const entity = await this.model
      .findOne<MongoUserEntity>(this.mapper.transformQuery(query))
      .exec();

    if (!entity) {
      return left(new NotFoundException(`${this.model.modelName} not found`));
    }

    return right(entity.toJSON({ flattenMaps: false }));
  }
}
