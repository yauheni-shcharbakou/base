import { Module } from '@nestjs/common';
import { UserRpcController } from 'modules/user/rpc/user.rpc.controller';
import { UserServiceModule } from 'modules/user/service/user.service.module';

@Module({
  imports: [UserServiceModule],
  controllers: [UserRpcController],
})
export class UserRpcModule {}
