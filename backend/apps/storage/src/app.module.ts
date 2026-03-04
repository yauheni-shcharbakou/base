import { PostgresModule } from '@backend/persistence';
import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { Database } from '@packages/common';
import { config } from 'config';
import { FileModule } from 'modules/file/file.module';
import { ImageModule } from 'modules/image/image.module';
import { StorageObjectModule } from 'modules/storage-object/storage-object.module';

// TODO: implement video entity stuff, check postgres cascade deletion

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    PostgresModule.forRoot({ database: Database.STORAGE }),
    GrpcModule.forRoot({ host: 'storage' }),
    FileModule,
    ImageModule,
    StorageObjectModule,
  ],
})
export class AppModule {}
