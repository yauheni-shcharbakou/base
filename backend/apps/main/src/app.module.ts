import { MongoModule } from '@backend/persistence';
import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MAIN_PACKAGE_NAME } from '@packages/grpc.nest';
import { migrationTasks } from 'common/migrations';
import { config } from 'config';
import { ContactModule } from 'modules/contact/contact.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    MongoModule.forRoot({
      migration: {
        tasks: migrationTasks,
      },
    }),
    GrpcModule.forRoot({ package: MAIN_PACKAGE_NAME }),
    ContactModule,
  ],
})
export class AppModule {}
