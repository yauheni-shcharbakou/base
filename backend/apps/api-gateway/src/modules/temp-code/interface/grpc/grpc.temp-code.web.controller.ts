import {
  GrpcTempCodeWebServiceController,
  GrpcTempCodeWebTransport,
  NestAuth,
  NestGoogle,
} from '@backend/proto';
import { DefaultGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { GrpcUserId } from '@common/interface/grpc/decorators/grpc.user-id.decorator';
import { TempCodeProxyService } from '../../application/services/temp-code.proxy.service';

@DefaultGrpcController()
@GrpcTempCodeWebTransport.ControllerMethods()
export class GrpcTempCodeWebController implements GrpcTempCodeWebServiceController {
  constructor(private readonly tempCodeService: TempCodeProxyService) {}

  async generate(_: NestGoogle.Empty, @GrpcUserId() userId: string): Promise<NestAuth.TempCode> {
    return this.tempCodeService.createOne({ user: userId });
  }
}
