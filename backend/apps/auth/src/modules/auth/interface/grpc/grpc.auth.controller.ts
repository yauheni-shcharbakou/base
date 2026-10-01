import { GrpcController, GrpcRxPipe } from '@backend/grpc';
import { GrpcAuthServiceController, GrpcAuthTransport, NestAuth } from '@backend/proto';
import { AuthGetUserByTokenUseCase } from '@modules/auth/application/use-cases/auth.get-user-by-token.use-case';
import { AuthLoginUseCase } from '@modules/auth/application/use-cases/auth.login.use-case';
import { AuthLogoutUseCase } from '@modules/auth/application/use-cases/auth.logout.use-case';
import { AuthRefreshTokenUseCase } from '@modules/auth/application/use-cases/auth.refresh-token.use-case';
import { firstValueFrom, from, Observable } from 'rxjs';

@GrpcController()
@GrpcAuthTransport.ControllerMethods()
export class GrpcAuthController implements GrpcAuthServiceController {
  constructor(
    private readonly loginUseCase: AuthLoginUseCase,
    private readonly refreshTokenUseCase: AuthRefreshTokenUseCase,
    private readonly getUserByTokenUseCase: AuthGetUserByTokenUseCase,
    private readonly logoutUseCase: AuthLogoutUseCase,
  ) {}

  login(request: NestAuth.AuthLogin): Observable<NestAuth.AuthData> {
    return from(this.loginUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  refreshToken(request: NestAuth.AuthRefresh): Observable<NestAuth.AuthData> {
    return from(this.refreshTokenUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  // An `Empty` response is typed `void | Promise<void>` by the generated controller, so this one
  // awaits the pipe instead of returning it.
  async logout(request: NestAuth.AuthLogout): Promise<void> {
    await firstValueFrom(from(this.logoutUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither));
  }

  me(request: NestAuth.AuthMe): Observable<NestAuth.User> {
    return from(this.getUserByTokenUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }
}
