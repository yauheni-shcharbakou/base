import { GrpcModule } from '@backend/grpc';
import { GrpcAuthTransport } from '@backend/proto';
import { Module } from '@nestjs/common';
import { AuthProxyService } from './application/services/auth.proxy.service';
import { GrpcAuthPublicController } from './interface/grpc/grpc.auth.public.controller';

@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        auth: [GrpcAuthTransport.service],
      },
    }),
  ],
  providers: [AuthProxyService],
  controllers: [GrpcAuthPublicController],
})
export class AuthModule {}
