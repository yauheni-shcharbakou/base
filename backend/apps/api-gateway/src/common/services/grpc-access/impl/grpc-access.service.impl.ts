import { MemoryCache } from '@backend/common';
import {
  GrpcAuthService,
  GrpcAuthServiceClient,
  GrpcAuthStreamCode,
  GrpcTempCode,
  GrpcUser,
} from '@backend/grpc';
import { InjectGrpcService, InjectNatsClient, NatsClient } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { ForbiddenException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { GrpcAccessService } from 'common/services/grpc-access/grpc-access.service';
import _ from 'lodash';
import moment from 'moment';
import { map, Observable, of } from 'rxjs';

type CachedUser = Pick<GrpcUser, 'id' | 'role'>;

type CachedStreamCode = CachedUser & {
  codeId: string;
};

@Injectable()
export class GrpcAccessServiceImpl implements GrpcAccessService, OnModuleDestroy {
  private readonly unaryCache = new MemoryCache<CachedUser>();
  private readonly streamCache = new MemoryCache<CachedStreamCode>();

  constructor(
    @InjectGrpcService(GrpcAuthService.name)
    private readonly authServiceClient: GrpcAuthServiceClient,
    @InjectNatsClient() private readonly natsClient: NatsClient,
  ) {}

  onModuleDestroy() {
    this.unaryCache.reset();
    this.streamCache.reset();
  }

  checkAccess(
    metadata?: Metadata,
    allowedRoles: string[] = [],
  ): Observable<Either<Error, Metadata>> {
    const accessToken = metadata?.get('access-token')?.[0]?.toString();

    if (!accessToken) {
      return of(left(new ForbiddenException('Access token is missing')));
    }

    const cachedUser = this.unaryCache.get(accessToken);

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
        this.unaryCache.set(accessToken, _.pick(user, ['id', 'role']));
        return right(metadata.clone());
      }),
    );
  }

  checkStreamAccess(metadata?: Metadata, allowedRoles: string[] = []): Either<Error, Metadata> {
    const streamCode = metadata?.get('stream-code')?.[0]?.toString();

    if (!streamCode) {
      return left(new ForbiddenException('Stream code is missing'));
    }

    const cachedStreamCode = this.streamCache.get(streamCode);

    if (!cachedStreamCode) {
      return left(new ForbiddenException());
    }

    if (!_.includes(allowedRoles, cachedStreamCode.role)) {
      return left(new ForbiddenException('Invalid role'));
    }

    this.natsClient.auth.tempCode.deactivateOne({ id: cachedStreamCode.codeId }).subscribe();

    metadata.set('user', cachedStreamCode.id);
    return right(metadata.clone());
  }

  addStreamCode(data: GrpcTempCode, user: GrpcUser): GrpcAuthStreamCode {
    const delay = moment(data.expiredAt).diff(moment(), 'milliseconds');
    this.streamCache.set(data.code, { codeId: data.id, id: user.id, role: user.role }, delay);

    return {
      code: data.code,
      expireDate: data.expiredAt,
    };
  }
}
