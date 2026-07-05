import { CryptoModule } from '@modules/crypto/crypto.module';
import { UserModule } from '@modules/user/user.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthGetUserByTokenUseCase } from './application/use-cases/auth.get-user-by-token.use-case';
import { AuthLoginUseCase } from './application/use-cases/auth.login.use-case';
import { AuthRefreshTokenUseCase } from './application/use-cases/auth.refresh-token.use-case';
import { AuthTokenService } from './domain/services/auth.token.service';
import { jwtConfig } from './infrastructure/configs/jwt.config';
import { JwtAuthTokenServiceImpl } from './infrastructure/services/jwt.auth.token.service.impl';
import { GrpcAuthController } from './interface/grpc/grpc.auth.controller';

@Module({
  imports: [UserModule, JwtModule, ConfigModule.forFeature(jwtConfig), CryptoModule],
  providers: [
    {
      provide: AuthTokenService,
      useClass: JwtAuthTokenServiceImpl,
    },
    AuthLoginUseCase,
    AuthRefreshTokenUseCase,
    AuthGetUserByTokenUseCase,
  ],
  controllers: [GrpcAuthController],
})
export class AuthModule {}
