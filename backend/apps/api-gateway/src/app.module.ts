import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AUTH_SERVICE_NAME } from '@backend/grpc';
import { config } from 'config';
import { AuthModule } from 'modules/auth/auth.module';

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
        auth: [AUTH_SERVICE_NAME],
      },
    }),
    AuthModule,
  ],
})
export class AppModule {}
