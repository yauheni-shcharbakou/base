import { MongoModule } from '@backend/persistence';
import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Database } from '@packages/common';
import { migrationTasks } from 'common/migrations';
import { config } from 'config';
import { ContactModule } from 'modules/contact/contact.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    MongoModule.forRoot({
      database: Database.MAIN,
      migration: {
        tasks: migrationTasks,
      },
    }),
    GrpcModule.forRoot({ host: 'main' }),
    ContactModule,
  ],
})
export class AppModule {}
