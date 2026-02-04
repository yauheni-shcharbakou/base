import { Module } from '@nestjs/common';
import { UserRpcModule } from 'modules/user/rpc/user.rpc.module';

@Module({
  imports: [UserRpcModule],
})
export class UserModule {}
