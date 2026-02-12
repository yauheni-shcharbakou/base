import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { GrpcAuthService, GrpcFileService } from '@backend/grpc';
import { FileRpcController } from 'modules/file/rpc/file.rpc.controller';

@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        auth: [GrpcAuthService.name],
        file: [GrpcFileService.name],
      },
    }),
  ],
  controllers: [FileRpcController],
})
export class FileRpcModule {}
