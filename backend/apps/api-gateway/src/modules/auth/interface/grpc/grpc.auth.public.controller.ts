import { ValidateGrpcPayload } from '@backend/grpc';
import { GrpcAuthPublicServiceController, GrpcAuthPublicTransport, NestAuth } from '@backend/proto';
import { PublicGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { AuthLoginDto } from '@modules/auth/application/dto/auth.login.dto';
import { AuthRefreshDto } from '@modules/auth/application/dto/auth.refresh.dto';
import { AuthProxyService } from '@modules/auth/application/services/auth.proxy.service';

@PublicGrpcController()
@GrpcAuthPublicTransport.ControllerMethods()
export class GrpcAuthPublicController implements GrpcAuthPublicServiceController {
  constructor(private readonly authService: AuthProxyService) {}

  @ValidateGrpcPayload(AuthLoginDto)
  login(request: NestAuth.AuthLogin): Promise<NestAuth.AuthData> {
    return this.authService.login(request);
  }

  @ValidateGrpcPayload(AuthRefreshDto)
  refreshToken(request: NestAuth.AuthRefresh): Promise<NestAuth.AuthData> {
    return this.authService.refreshToken(request);
  }
}
