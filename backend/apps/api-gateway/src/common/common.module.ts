import { GrpcModule } from '@backend/grpc';
import { GrpcAuthTransport, GrpcTempCodeTransport } from '@backend/proto';
import { Global, Module } from '@nestjs/common';
import { AccessService } from './domain/services/access.service';

@Global()
@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        auth: [GrpcAuthTransport.service, GrpcTempCodeTransport.service],
      },
    }),
  ],
  providers: [AccessService],
  exports: [AccessService],
})
export class CommonModule {}
