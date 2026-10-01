import { AuthTokenPayloadParsed } from '@backend/common';
import { InjectGrpcService } from '@backend/grpc';
import { GrpcAuthServiceClient, GrpcAuthTransport, NestAuth } from '@backend/proto';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import { map, Observable } from 'rxjs';
import { TokenService } from './token.service';

@Injectable()
export class AccessService {
  constructor(
    @InjectGrpcService(GrpcAuthTransport.service)
    private readonly authServiceClient: GrpcAuthServiceClient,
    private readonly tokenService: TokenService,
  ) {}

  checkUnaryAccess(
    accessToken?: string,
    allowedRoles: string[] = [],
  ): Observable<Either<Error, NestAuth.User>> {
    return this.authServiceClient.me({ accessToken }).pipe(
      map((user) => {
        if (!_.includes(allowedRoles, user.role)) {
          return left(new ForbiddenException('Invalid role'));
        }

        return right(user);
      }),
    );
  }

  // Stream guards cannot await anything: an async guard defers the handler and the
  // incoming gRPC message stream stalls. Hence local token verification instead of
  // a call to the auth service.
  checkStreamAccess(
    accessToken?: string,
    allowedRoles: string[] = [],
  ): Either<Error, AuthTokenPayloadParsed> {
    const payload = this.tokenService.verifyAccessToken(accessToken);

    if (payload.isLeft()) {
      return payload;
    }

    if (!_.includes(allowedRoles, payload.value.role)) {
      return left(new ForbiddenException('Invalid role'));
    }

    return payload;
  }
}
