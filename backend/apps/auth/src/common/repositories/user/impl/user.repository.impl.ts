import { MongoMapper, MongoRepositoryImpl } from '@backend/persistence';
import { InjectModel } from '@nestjs/mongoose';
import { UserEntity } from 'common/entities/user.entity';
import { UserInternal } from 'common/interfaces/user.interface';
import { UserRepository } from 'common/repositories/user/user.repository';
import { Model } from 'mongoose';

export class UserRepositoryImpl
  extends MongoRepositoryImpl<UserEntity, UserInternal>
  implements UserRepository
{
  constructor(@InjectModel(UserEntity.name) protected readonly model: Model<UserEntity>) {
    super(model, new MongoMapper());
  }
}
