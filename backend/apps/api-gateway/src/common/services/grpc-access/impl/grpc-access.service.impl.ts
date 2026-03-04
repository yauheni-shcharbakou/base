import { MemoryCache } from '@backend/common';
import { GrpcAuthService, GrpcAuthServiceClient, GrpcUser } from '@backend/grpc';
import { InjectGrpcService } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { ForbiddenException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { GrpcAccessService } from 'common/services/grpc-access/grpc-access.service';
import _ from 'lodash';
import { map, Observable, of } from 'rxjs';

@Injectable()
export class GrpcAccessServiceImpl implements GrpcAccessService, OnModuleDestroy {
  private readonly userCache = new MemoryCache<Pick<GrpcUser, 'id' | 'role'>>();

  constructor(
    @InjectGrpcService(GrpcAuthService.name)
    private readonly authServiceClient: GrpcAuthServiceClient,
  ) {}

  onModuleDestroy() {
    this.userCache.reset();
  }

  checkAccess(
    metadata?: Metadata,
    allowedRoles: string[] = [],
  ): Observable<Either<Error, Metadata>> {
    const accessToken = metadata?.get('access-token')?.[0]?.toString();

    if (!accessToken) {
      return of(left(new ForbiddenException('Access token is missing')));
    }

    const cachedUser = this.userCache.get(accessToken);

    if (cachedUser) {
      if (!_.includes(allowedRoles, cachedUser.role)) {
        return of(left(new ForbiddenException('Invalid role')));
      }

      metadata.set('user', cachedUser.id);
      return of(right(metadata.clone()));
    }

    return this.authServiceClient.me({ accessToken }).pipe(
      map((user) => {
        if (!_.includes(allowedRoles, user.role)) {
          return left(new ForbiddenException('Invalid role'));
        }

        metadata.set('user', user.id);
        this.userCache.set(accessToken, _.pick(user, ['id', 'role']));
        return right(metadata.clone());
      }),
    );
  }
}
