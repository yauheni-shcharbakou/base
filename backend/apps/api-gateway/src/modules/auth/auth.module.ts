import { GrpcProxyModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { grpcAuthProxyControllerFactory } from '@packages/grpc.nest';
import { AuthLoginDto } from 'modules/auth/dto/auth.login.dto';
import { AuthMeDto } from 'modules/auth/dto/auth.me.dto';
import { AuthRefreshDto } from 'modules/auth/dto/auth.refresh.dto';
import { AuthWebModule } from 'modules/auth/web/auth.web.module';

@Module({
  imports: [
    GrpcProxyModule.register({
      host: 'auth',
      controllerFactory: grpcAuthProxyControllerFactory,
      dtoSchema: {
        me: AuthMeDto,
        login: AuthLoginDto,
        refreshToken: AuthRefreshDto,
      },
    }),
    AuthWebModule,
  ],
})
export class AuthModule {}
