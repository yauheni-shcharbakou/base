import {
  GrpcAuthData,
  GrpcAuthLogin,
  GrpcAuthMe,
  GrpcAuthProxyService,
  GrpcAuthProxyServiceController,
  GrpcAuthRefresh,
  GrpcAuthService,
  GrpcAuthServiceClient,
  GrpcAuthStreamCode,
  GrpcTempCodeService,
  GrpcTempCodeServiceClient,
  GrpcUser,
} from '@backend/grpc';
import { GrpcRxPipe, InjectGrpcService, ValidateGrpcPayload } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { Inject } from '@nestjs/common';
import { PublicGrpcController } from 'common/decorators/access.decorator';
import { AuthLoginDto, AuthMeDto, AuthRefreshDto } from 'common/dto/services/auth/auth.service.dto';
import {
  GRPC_ACCESS_SERVICE,
  GrpcAccessService,
} from 'common/services/grpc-access/grpc-access.service';
import { map, Observable, of, switchMap } from 'rxjs';

@PublicGrpcController()
@GrpcAuthProxyService.ControllerMethods()
export class AuthRpcController implements GrpcAuthProxyServiceController {
  constructor(
    @InjectGrpcService(GrpcAuthService.name)
    private readonly authServiceClient: GrpcAuthServiceClient,
    @InjectGrpcService(GrpcTempCodeService.name)
    private readonly tempCodeServiceClient: GrpcTempCodeServiceClient,
    @Inject(GRPC_ACCESS_SERVICE) private readonly accessService: GrpcAccessService,
  ) {}

  @ValidateGrpcPayload(AuthLoginDto)
  login(request: GrpcAuthLogin, metadata?: Metadata): Observable<GrpcAuthData> {
    return this.authServiceClient.login(request, metadata?.clone()).pipe(GrpcRxPipe.rpcException);
  }

  @ValidateGrpcPayload(AuthRefreshDto)
  refreshToken(request: GrpcAuthRefresh, metadata?: Metadata): Observable<GrpcAuthData> {
    return this.authServiceClient
      .refreshToken(request, metadata?.clone())
      .pipe(GrpcRxPipe.rpcException);
  }

  @ValidateGrpcPayload(AuthMeDto)
  me(request: GrpcAuthMe, metadata?: Metadata): Observable<GrpcUser> {
    return this.authServiceClient.me(request, metadata?.clone()).pipe(GrpcRxPipe.rpcException);
  }

  @ValidateGrpcPayload(AuthMeDto)
  generateStreamCode(request: GrpcAuthMe, metadata?: Metadata): Observable<GrpcAuthStreamCode> {
    return this.authServiceClient.me(request, metadata?.clone()).pipe(
      switchMap((user) =>
        this.tempCodeServiceClient
          .createOne({ user: user.id })
          .pipe(map((tempCode) => ({ user, tempCode }))),
      ),
      switchMap(({ user, tempCode }) => of(this.accessService.addStreamCode(tempCode, user))),
      GrpcRxPipe.rpcException,
    );
  }
}
