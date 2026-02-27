import { PostgresModule, PostgresRequestInterceptor } from '@backend/persistence';
import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { Database } from '@packages/common';
import { config } from 'config';
import { FileModule } from 'modules/file/file.module';
import { ImageModule } from 'modules/image/image.module';
import { StorageObjectModule } from 'modules/storage-object/storage-object.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    // MongoModule.forRoot({
    //   database: Database.STORAGE,
    //   migration: {
    //     imports: [ConfigModule],
    //     tasks: migrationTasks,
    //     entities: [MongoFileEntity],
    //   },
    // }),
    PostgresModule.forRoot({ database: Database.STORAGE }),
    GrpcModule.forRoot({ host: 'storage' }),
    FileModule,
    ImageModule,
    StorageObjectModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: PostgresRequestInterceptor,
    },
  ],
})
export class AppModule {}
