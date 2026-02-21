import { MongoModule } from '@backend/persistence';
import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Database } from '@packages/common';
import { FileEntity } from 'common/repositories/file/entities/file.entity';
import { migrationTasks } from 'common/migrations';
import { config } from 'config';
import { FileModule } from 'modules/file/file.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    MongoModule.forRoot({
      database: Database.FILE,
      migration: {
        imports: [ConfigModule],
        tasks: migrationTasks,
        entities: [FileEntity],
      },
    }),
    GrpcModule.forRoot({ host: 'file' }),
    FileModule,
  ],
})
export class AppModule {}
