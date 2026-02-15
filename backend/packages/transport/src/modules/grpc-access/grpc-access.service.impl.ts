import { GrpcAccessService, GrpcAuthService, GrpcAuthServiceClient } from '@backend/grpc';
import { Metadata } from '@grpc/grpc-js';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { InjectGrpcService } from 'decorators';
import _ from 'lodash';
import { map, Observable, of } from 'rxjs';

@Injectable()
export class GrpcAccessServiceImpl implements GrpcAccessService {
  constructor(
    @InjectGrpcService(GrpcAuthService.name)
    private readonly authServiceClient: GrpcAuthServiceClient,
  ) {}

  checkAccess(
    metadata?: Metadata,
    allowedRoles: string[] = [],
  ): Observable<Either<Error, Metadata>> {
    const accessToken = metadata?.get('access-token')?.[0]?.toString();

    if (!accessToken) {
      return of(left(new ForbiddenException('Access token is missing')));
    }

    return this.authServiceClient.me({ accessToken }).pipe(
      map((user) => {
        if (!_.includes(allowedRoles, user.role)) {
          return left(new ForbiddenException('Invalid role'));
        }

        metadata.set('user', user.id);
        return right(metadata.clone());
      }),
    );
  }
}
