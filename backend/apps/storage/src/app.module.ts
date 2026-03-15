import { PostgresModule } from '@backend/persistence';
import { GrpcModule, NatsJsModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { Database } from '@packages/common';
import { config } from 'config';
import { FileModule } from 'modules/file/file.module';
import { ImageModule } from 'modules/image/image.module';
import { StorageObjectModule } from 'modules/storage-object/storage-object.module';
import { VideoModule } from 'modules/video/video.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    PostgresModule.forRoot({ database: Database.STORAGE }),
    GrpcModule.forRoot({ host: 'storage' }),
    NatsJsModule.forRoot({ host: 'storage' }),
    FileModule,
    ImageModule,
    StorageObjectModule,
    VideoModule,
  ],
})
export class AppModule {}
