import { GrpcModule } from '@backend/grpc';
import { GrpcAuthTransport } from '@backend/proto';
import { CommonModule } from '@common/common.module';
import { AuthModule } from '@modules/auth/auth.module';
import { FileModule } from '@modules/file/file.module';
import { ImageModule } from '@modules/image/image.module';
import { StorageObjectModule } from '@modules/storage-object/storage-object.module';
import { TempCodeModule } from '@modules/temp-code/temp-code.module';
import { UserModule } from '@modules/user/user.module';
import { VideoModule } from '@modules/video/video.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { config } from './config';

// TODO: add anti-sql injection decorators

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60 * 1000,
          limit: 100,
        },
      ],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
    }),
    GrpcModule.forRoot({
      host: 'apiGateway',
      appClientStrategy: {
        auth: [GrpcAuthTransport.service],
      },
    }),
    CommonModule,
    AuthModule,
    FileModule,
    ImageModule,
    StorageObjectModule,
    TempCodeModule,
    UserModule,
    VideoModule,
  ],
})
export class AppModule {}
