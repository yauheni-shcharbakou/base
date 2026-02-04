import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserEntity, UserSchema } from 'common/entities/user.entity';
import { UserRepositoryImpl } from 'common/repositories/user/impl/user.repository.impl';
import { USER_REPOSITORY } from 'common/repositories/user/user.repository';

@Module({
  imports: [MongooseModule.forFeature([{ name: UserEntity.name, schema: UserSchema }])],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: UserRepositoryImpl,
    },
  ],
  exports: [USER_REPOSITORY],
})
export class UserRepositoryModule {}
