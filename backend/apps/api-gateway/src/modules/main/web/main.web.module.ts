import { GrpcModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { CONTACT_SERVICE_NAME } from '@packages/grpc.nest';
import { MainWebController } from 'modules/main/web/main.web.controller';

@Module({
  imports: [
    GrpcModule.forFeature({
      strategy: {
        main: [CONTACT_SERVICE_NAME],
      },
    }),
  ],
  controllers: [MainWebController],
})
export class MainWebModule {}
