import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CryptoModule } from 'common/modules/crypto/crypto.module';
import { UserRepositoryModule } from 'common/repositories/user/user.repository.module';
import { Config } from 'config';
import { AUTH_SERVICE } from 'modules/auth/service/auth.service';
import { AuthServiceImpl } from 'modules/auth/service/impl/auth.service.impl';

@Module({
  imports: [
    CryptoModule,
    UserRepositoryModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService<Config>) => {
        return configService.getOrThrow('jwt.accessToken', { infer: true });
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: AUTH_SERVICE,
      useClass: AuthServiceImpl,
    },
  ],
  exports: [AUTH_SERVICE],
})
export class AuthServiceModule {}
