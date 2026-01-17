import { MongoModule } from '@backend/persistence';
import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Database } from '@packages/common';
import { migrationTasks } from 'common/migrations';
import { config } from 'config';
import { AuthModule } from 'modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    MongoModule.forRoot({
      database: Database.AUTH,
      migration: {
        tasks: migrationTasks,
      },
    }),
    GrpcModule.forRoot({ host: 'auth' }),
    AuthModule,
  ],
})
export class AppModule {}
