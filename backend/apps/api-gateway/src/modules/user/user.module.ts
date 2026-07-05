import { GrpcModule } from '@backend/grpc';
import { GrpcUserTransport } from '@backend/proto';
import { Module } from '@nestjs/common';
import { UserProxyService } from './application/services/user.proxy.service';
import { GrpcUserAdminController } from './interface/grpc/grpc.user.admin.controller';
import { GrpcUserWebController } from './interface/grpc/grpc.user.web.controller';

@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        auth: [GrpcUserTransport.service],
      },
    }),
  ],
  providers: [UserProxyService],
  exports: [UserProxyService],
  controllers: [GrpcUserWebController, GrpcUserAdminController],
})
export class UserModule {}
