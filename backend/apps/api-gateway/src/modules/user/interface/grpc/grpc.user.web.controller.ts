import {
  GrpcUserWebServiceController,
  GrpcUserWebTransport,
  NestAuth,
  NestGoogle,
} from '@backend/proto';
import { DefaultGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { GrpcUserId } from '@common/interface/grpc/decorators/grpc.user-id.decorator';
import { UserProxyService } from '@modules/user/application/services/user.proxy.service';
import { Payload } from '@nestjs/microservices';

@DefaultGrpcController()
@GrpcUserWebTransport.ControllerMethods()
export class GrpcUserWebController implements GrpcUserWebServiceController {
  constructor(private readonly userService: UserProxyService) {}

  getOne(@Payload() _: NestGoogle.Empty, @GrpcUserId() userId: string): Promise<NestAuth.User> {
    return this.userService.getById(userId);
  }
}
