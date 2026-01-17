import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { config } from 'config';
import { AuthModule } from 'modules/auth/auth.module';
import { MainModule } from 'modules/main/main.module';

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
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    GrpcModule.forRoot({ host: 'apiGateway' }),
    AuthModule,
    MainModule,
  ],
})
export class AppModule {}
