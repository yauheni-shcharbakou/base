import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CryptoModule } from 'common/modules/crypto/crypto.module';
import { UserRepositoryModule } from 'common/repositories/user/user.repository.module';
import { AUTH_SERVICE } from 'modules/auth/service/auth.service';
import { AuthServiceImpl } from 'modules/auth/service/impl/auth.service.impl';

@Module({
  imports: [CryptoModule, UserRepositoryModule, JwtModule],
  providers: [
    {
      provide: AUTH_SERVICE,
      useClass: AuthServiceImpl,
    },
  ],
  exports: [AUTH_SERVICE],
})
export class AuthServiceModule {}
