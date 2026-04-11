import { GrpcModule, NatsModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { GrpcAuthService } from '@backend/grpc';
import { GrpcAccessModule } from 'common/services/grpc-access/grpc-access.module';
import { config } from 'config';
import { AuthModule } from 'modules/auth/auth.module';
import { StorageModule } from 'modules/storage/storage.module';

// TODO: add anti-sql injection decorators & limits for arrays by length to DTOs

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60 * 1000,
          limit: 100,
        },
      ],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
    }),
    GrpcModule.forRoot({
      host: 'apiGateway',
      appClientStrategy: {
        auth: [GrpcAuthService.name],
      },
    }),
    NatsModule.forRoot({ host: 'apiGateway', onlyEmitting: true }),
    GrpcAccessModule,
    AuthModule,
    StorageModule,
  ],
})
export class AppModule {}
