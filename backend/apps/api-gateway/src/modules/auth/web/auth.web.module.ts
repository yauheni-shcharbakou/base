import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { GrpcAuthService } from '@backend/grpc';
import { AuthWebController } from 'modules/auth/web/auth.web.controller';

@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        auth: [GrpcAuthService.name],
      },
    }),
  ],
  controllers: [AuthWebController],
})
export class AuthWebModule {}
