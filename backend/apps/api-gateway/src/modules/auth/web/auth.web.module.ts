import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { AUTH_SERVICE_NAME } from '@backend/grpc';
import { AuthWebController } from 'modules/auth/web/auth.web.controller';

@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        auth: [AUTH_SERVICE_NAME],
      },
    }),
  ],
  controllers: [AuthWebController],
})
export class AuthWebModule {}
