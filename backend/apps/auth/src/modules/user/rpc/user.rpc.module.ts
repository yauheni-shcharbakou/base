import { Module } from '@nestjs/common';
import { UserRepositoryModule } from 'common/repositories/user/user.repository.module';
import { UserRpcController } from 'modules/user/rpc/user.rpc.controller';
import { UserServiceModule } from 'modules/user/service/user.service.module';

@Module({
  imports: [UserRepositoryModule, UserServiceModule],
  controllers: [UserRpcController],
})
export class UserRpcModule {}
