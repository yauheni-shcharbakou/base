import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserRepositoryModule } from 'common/repositories/user/user.repository.module';
import { CryptoServiceModule } from 'common/services/crypto/crypto.service.module';
import { AUTH_SERVICE } from 'modules/auth/service/auth.service';
import { AuthServiceImpl } from 'modules/auth/service/impl/auth.service.impl';

@Module({
  imports: [CryptoServiceModule, UserRepositoryModule, JwtModule],
  providers: [
    {
      provide: AUTH_SERVICE,
      useClass: AuthServiceImpl,
    },
  ],
  exports: [AUTH_SERVICE],
})
export class AuthServiceModule {}
