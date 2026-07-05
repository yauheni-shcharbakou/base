import { GrpcModule } from '@backend/grpc';
import { GrpcVideoTransport } from '@backend/proto';
import { Module } from '@nestjs/common';
import { VideoMapper } from './application/mappers/video.mapper';
import { VideoProxyService } from './application/services/video.proxy.service';
import { GrpcVideoAdminController } from './interface/grpc/grpc.video.admin.controller';
import { GrpcVideoWebController } from './interface/grpc/grpc.video.web.controller';

@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        storage: [GrpcVideoTransport.service],
      },
    }),
  ],
  providers: [VideoMapper, VideoProxyService],
  controllers: [GrpcVideoWebController, GrpcVideoAdminController],
})
export class VideoModule {}
