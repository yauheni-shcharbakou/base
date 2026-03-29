import { GrpcAuthService } from '@backend/grpc';
import { GrpcModule } from '@backend/transport';
import { Global, Module } from '@nestjs/common';
import { GRPC_ACCESS_SERVICE } from 'common/services/grpc-access/grpc-access.service';
import { GrpcAccessServiceImpl } from 'common/services/grpc-access/impl/grpc-access.service.impl';

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
