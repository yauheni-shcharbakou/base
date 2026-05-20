import { EventBusHost } from '@backend/event-bus';
import { GrpcModule } from '@backend/grpc';
import { NatsModule } from '@backend/nats';
import { PgModule } from '@backend/pg';
import { FileModule } from '@modules/file/file.module';
import { StorageObjectModule } from '@modules/storage-object/storage-object.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { Database } from '@packages/common';
import { config } from './config';

// TODO: implement deletion for folders with files

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    PgModule.forRoot({ database: Database.STORAGE }),
    GrpcModule.forRoot({ host: 'storage' }),
    NatsModule.forRoot({ host: EventBusHost.STORAGE }),
    FileModule,
    StorageObjectModule,
  ],
})
export class AppModule {}
