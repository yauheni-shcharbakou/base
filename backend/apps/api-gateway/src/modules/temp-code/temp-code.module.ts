import { GrpcModule } from '@backend/grpc';
import { GrpcTempCodeTransport } from '@backend/proto';
import { UserModule } from '@modules/user/user.module';
import { Module } from '@nestjs/common';
import { TempCodeProxyService } from './application/services/temp-code.proxy.service';
import { GrpcTempCodeAdminController } from './interface/grpc/grpc.temp-code.admin.controller';
import { GrpcTempCodeWebController } from './interface/grpc/grpc.temp-code.web.controller';

@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        auth: [GrpcTempCodeTransport.service],
      },
    }),
    UserModule,
  ],
  providers: [TempCodeProxyService],
  controllers: [GrpcTempCodeWebController, GrpcTempCodeAdminController],
})
export class TempCodeModule {}
