import { MongoModule } from '@backend/persistence';
import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AUTH_PACKAGE_NAME } from '@packages/grpc.nest';
import { migrationTasks } from 'common/migrations';
import { config } from 'config';
import { AuthModule } from 'modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    MongoModule.forRoot({
      migration: {
        tasks: migrationTasks,
      },
    }),
    GrpcModule.forRoot({ package: AUTH_PACKAGE_NAME }),
    AuthModule,
  ],
})
export class AppModule {}
