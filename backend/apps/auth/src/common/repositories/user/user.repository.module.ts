import { MongoModule } from '@backend/persistence';
import { Module } from '@nestjs/common';
import { UserEntity } from 'common/repositories/user/entities/user.entity';
import { UserRepositoryImpl } from 'common/repositories/user/impl/user.repository.impl';
import { USER_REPOSITORY } from 'common/repositories/user/user.repository';

@Module({
  imports: [MongoModule.forFeature(UserEntity)],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: UserRepositoryImpl,
    },
  ],
  exports: [USER_REPOSITORY],
})
export class UserRepositoryModule {}
