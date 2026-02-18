import { GrpcController, GrpcRxPipe } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { Inject } from '@nestjs/common';
import {
  GrpcAuthData,
  GrpcAuthLogin,
  GrpcAuthMe,
  GrpcAuthRefresh,
  GrpcAuthService,
  GrpcAuthServiceController,
  GrpcUser,
} from '@backend/grpc';
import { AUTH_SERVICE, AuthService } from 'modules/auth/service/auth.service';
import { Observable } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

@GrpcController()
@GrpcAuthService.ControllerMethods()
export class AuthRpcController implements GrpcAuthServiceController {
  constructor(@Inject(AUTH_SERVICE) private readonly authService: AuthService) {}

  login(request: GrpcAuthLogin, metadata?: Metadata): Observable<GrpcAuthData> {
    return fromPromise(this.authService.login(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  refreshToken(request: GrpcAuthRefresh, metadata?: Metadata): Observable<GrpcAuthData> {
    return fromPromise(this.authService.refreshToken(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  me(request: GrpcAuthMe, metadata?: Metadata): Observable<GrpcUser> {
    return fromPromise(this.authService.getUserByToken(request)).pipe(GrpcRxPipe.unwrapEither);
  }
}
