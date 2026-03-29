import { PostgresModule } from '@backend/persistence';
import { GrpcModule, NatsModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { Database } from '@packages/common';
import { config } from 'config';
import { AuthModule } from 'modules/auth/auth.module';
import { TempCodeModule } from 'modules/temp-code/temp-code.module';
import { UserModule } from 'modules/user/user.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    PostgresModule.forRoot({ database: Database.AUTH }),
    GrpcModule.forRoot({ host: 'auth' }),
    NatsModule.forRoot({ host: 'auth' }),
    AuthModule,
    TempCodeModule,
    UserModule,
  ],
})
export class AppModule {}
