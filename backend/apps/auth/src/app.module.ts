import { CacheModule } from '@backend/cache';
import { EventBusHost } from '@backend/event-bus';
import { GrpcModule } from '@backend/grpc';
import { PgModule } from '@backend/pg';
import { RedisModule } from '@backend/event-bus-redis';
import { AuthModule } from '@modules/auth/auth.module';
import { TempCodeModule } from '@modules/temp-code/temp-code.module';
import { UserModule } from '@modules/user/user.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { config } from './config';
import ormConfig from './mikro-orm.config';

// TODO: add user.avatarUrl

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    PgModule.forRoot(ormConfig),
    GrpcModule.forRoot({ host: 'auth' }),
    RedisModule.forRoot({ host: EventBusHost.AUTH }),
    CacheModule.forRoot({ namespace: 'auth' }),
    AuthModule,
    TempCodeModule,
    UserModule,
  ],
})
export class AppModule {}
