import { Module } from '@nestjs/common';
import { AuthRpcModule } from 'modules/auth/rpc/auth.rpc.module';

@Module({
  imports: [AuthRpcModule],
})
export class AuthModule {}
