import { GrpcController, GrpcRxPipe } from '@backend/grpc';
import { GrpcAuthServiceController, GrpcAuthTransport, NestAuth } from '@backend/proto';
import { AuthGetUserByTokenUseCase } from '@modules/auth/application/use-cases/auth.get-user-by-token.use-case';
import { AuthLoginUseCase } from '@modules/auth/application/use-cases/auth.login.use-case';
import { AuthRefreshTokenUseCase } from '@modules/auth/application/use-cases/auth.refresh-token.use-case';
import { from, Observable } from 'rxjs';

@GrpcController()
@GrpcAuthTransport.ControllerMethods()
export class GrpcAuthController implements GrpcAuthServiceController {
  constructor(
    private readonly loginUseCase: AuthLoginUseCase,
    private readonly refreshTokenUseCase: AuthRefreshTokenUseCase,
    private readonly getUserByTokenUseCase: AuthGetUserByTokenUseCase,
  ) {}

  login(request: NestAuth.AuthLogin): Observable<NestAuth.AuthData> {
    return from(this.loginUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  refreshToken(request: NestAuth.AuthRefresh): Observable<NestAuth.AuthData> {
    return from(this.refreshTokenUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  me(request: NestAuth.AuthMe): Observable<NestAuth.User> {
    return from(this.getUserByTokenUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }
}
