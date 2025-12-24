import { Module } from '@nestjs/common';
import { AuthWebModule } from 'modules/auth/web/auth.web.module';

@Module({
  imports: [AuthWebModule],
})
export class AuthModule {}
