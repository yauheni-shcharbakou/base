import { GrpcModule } from '@backend/grpc';
import { GrpcAuthTransport } from '@backend/proto';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccessService } from './domain/services/access.service';
import { TokenService } from './domain/services/token.service';
import { jwtConfig } from './infrastructure/configs/jwt.config';
import { JwtTokenServiceImpl } from './infrastructure/services/jwt.token.service.impl';
import { GRPC_THROTTLER_MODULE_OPTIONS } from './interface/grpc/constants/grpc.throttle.constants';

@Global()
@Module({
  imports: [
    // Enforced by `GrpcThrottlerGuard`, which the gRPC controller decorators apply; counted in
    // Redis through the global `CacheModule` the app module registers.
    ThrottlerModule.forRootAsync(GRPC_THROTTLER_MODULE_OPTIONS),
    ConfigModule.forFeature(jwtConfig),
    JwtModule,
    GrpcModule.forFeature({
      strategy: {
        auth: [GrpcAuthTransport.service],
      },
    }),
  ],
  providers: [
    {
      provide: TokenService,
      useClass: JwtTokenServiceImpl,
    },
    AccessService,
  ],
  exports: [AccessService],
})
export class CommonModule {}
