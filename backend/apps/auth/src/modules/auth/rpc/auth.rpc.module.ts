import { Module } from '@nestjs/common';
import { AuthRpcController } from 'modules/auth/rpc/auth.rpc.controller';
import { AuthServiceModule } from 'modules/auth/service/auth.service.module';

@Module({
  imports: [AuthServiceModule],
  controllers: [AuthRpcController],
})
export class AuthRpcModule {}
