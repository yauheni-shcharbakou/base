import { PostgresModule } from '@backend/persistence';
import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Database } from '@packages/common';
import { config } from 'config';
import { AuthModule } from 'modules/auth/auth.module';
import { UserModule } from 'modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    PostgresModule.forRoot({ database: Database.AUTH }),
    GrpcModule.forRoot({ host: 'auth' }),
    AuthModule,
    UserModule,
  ],
})
export class AppModule {}
