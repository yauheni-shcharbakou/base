import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { AUTH_SERVICE_NAME } from '@packages/grpc.nest';
import { AuthRpcController } from 'modules/auth/rpc/auth.rpc.controller';

@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        auth: [AUTH_SERVICE_NAME],
      },
    }),
  ],
  controllers: [AuthRpcController],
})
export class AuthRpcModule {}
