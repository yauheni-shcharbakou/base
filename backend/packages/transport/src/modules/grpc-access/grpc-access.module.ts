import { GRPC_ACCESS_SERVICE, GrpcAuthService } from '@backend/grpc';
import { Global, Module } from '@nestjs/common';
import { GrpcModule } from 'modules/grpc';
import { GrpcAccessServiceImpl } from 'modules/grpc-access/grpc-access.service.impl';

@Global()
@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        auth: [GrpcAuthService.name],
      },
    }),
  ],
  providers: [
    {
      provide: GRPC_ACCESS_SERVICE,
      useClass: GrpcAccessServiceImpl,
    },
  ],
  exports: [GRPC_ACCESS_SERVICE],
})
export class GrpcAccessModule {}
