import { GrpcModule } from '@backend/grpc';
import { GrpcImageTransport } from '@backend/proto';
import { Module } from '@nestjs/common';
import { ImageMapper } from './application/mappers/image.mapper';
import { ImageProxyService } from './application/services/image.proxy.service';
import { GrpcImageAdminController } from './interface/grpc/grpc.image.admin.controller';
import { GrpcImageWebController } from './interface/grpc/grpc.image.web.controller';

@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        storage: [GrpcImageTransport.service],
      },
    }),
  ],
  providers: [ImageMapper, ImageProxyService],
  controllers: [GrpcImageWebController, GrpcImageAdminController],
})
export class ImageModule {}
