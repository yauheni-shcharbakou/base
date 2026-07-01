import { GrpcModule } from '@backend/grpc';
import { GrpcFileTransport } from '@backend/proto';
import { Module } from '@nestjs/common';
import { FileMapper } from './application/mappers/file.mapper';
import { FileProxyService } from './application/services/file.proxy.service';
import { GrpcFileAdminController } from './interface/grpc/grpc.file.admin.controller';
import { GrpcFileWebController } from './interface/grpc/grpc.file.web.controller';

@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        storage: [GrpcFileTransport.service],
      },
    }),
  ],
  providers: [FileMapper, FileProxyService],
  controllers: [GrpcFileWebController, GrpcFileAdminController],
})
export class FileModule {}
