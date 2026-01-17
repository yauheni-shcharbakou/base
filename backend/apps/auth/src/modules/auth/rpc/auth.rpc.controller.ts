import { unwrapEither } from '@backend/common';
import { GrpcController } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { Inject } from '@nestjs/common';
import {
  AuthData,
  AuthLogin,
  AuthMe,
  AuthRefresh,
  AuthServiceController,
  AuthServiceControllerMethods,
  AuthTokens,
  User,
} from '@packages/grpc.nest';
import { AUTH_SERVICE, AuthService } from 'modules/auth/service/auth.service';
import { Observable } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

@GrpcController()
@AuthServiceControllerMethods()
export class AuthRpcController implements AuthServiceController {
  constructor(@Inject(AUTH_SERVICE) private readonly authService: AuthService) {}

  login(request: AuthLogin, metadata?: Metadata): Observable<AuthData> {
    return fromPromise(this.authService.login(request)).pipe(unwrapEither());
  }

  refreshToken(request: AuthRefresh, metadata?: Metadata): Observable<AuthTokens> {
    return fromPromise(this.authService.refreshToken(request)).pipe(unwrapEither());
  }

  me(request: AuthMe, metadata?: Metadata): Observable<User> {
    return fromPromise(this.authService.getUserByToken(request)).pipe(unwrapEither());
  }
}
