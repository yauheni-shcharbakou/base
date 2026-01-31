import { Module } from '@nestjs/common';
import { AuthRpcModule } from 'modules/auth/rpc/auth.rpc.module';
import { AuthWebModule } from 'modules/auth/web/auth.web.module';

@Module({
  imports: [AuthRpcModule, AuthWebModule],
})
export class AuthModule {}
