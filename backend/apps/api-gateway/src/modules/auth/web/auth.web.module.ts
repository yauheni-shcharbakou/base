import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { AUTH_PACKAGE_NAME, AUTH_SERVICE_NAME } from '@packages/grpc.nest';
import { AuthWebController } from 'modules/auth/web/auth.web.controller';

@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        [AUTH_PACKAGE_NAME]: [AUTH_SERVICE_NAME],
      },
    }),
  ],
  controllers: [AuthWebController],
})
export class AuthWebModule {}
