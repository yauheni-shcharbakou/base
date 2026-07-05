import { MemoryCache } from '@backend/common';
import { InjectGrpcService } from '@backend/grpc';
import {
  GrpcAuthServiceClient,
  GrpcAuthTransport,
  GrpcTempCodeServiceClient,
  GrpcTempCodeTransport,
  NestAuth,
} from '@backend/proto';
import { ForbiddenException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import moment from 'moment';
import { firstValueFrom, map, Observable, of } from 'rxjs';

type CachedStreamCode = NestAuth.User & {
  codeId: string;
};

@Injectable()
export class AccessService implements OnModuleDestroy {
  private readonly unaryCache = new MemoryCache<NestAuth.User>();
  private readonly streamCache = new MemoryCache<CachedStreamCode>();

  constructor(
    @InjectGrpcService(GrpcAuthTransport.service)
    private readonly authServiceClient: GrpcAuthServiceClient,
    @InjectGrpcService(GrpcTempCodeTransport.service)
    private readonly tempCodeServiceClient: GrpcTempCodeServiceClient,
  ) {}

  onModuleDestroy() {
    this.unaryCache.reset();
    this.streamCache.reset();
  }

  checkUnaryAccess(
    accessToken?: string,
    allowedRoles: string[] = [],
  ): Observable<Either<Error, NestAuth.User>> {
    const cachedUser = this.unaryCache.get(accessToken);

    if (cachedUser) {
      if (!_.includes(allowedRoles, cachedUser.role)) {
        return of(left(new ForbiddenException('Invalid role')));
      }

      return of(right(cachedUser));
    }

    return this.authServiceClient.me({ accessToken }).pipe(
      map((user) => {
        if (!_.includes(allowedRoles, user.role)) {
          return left(new ForbiddenException('Invalid role'));
        }

        this.unaryCache.set(accessToken, user);
        return right(user);
      }),
    );
  }

  checkStreamAccess(
    streamCode?: string,
    allowedRoles: string[] = [],
  ): Either<Error, NestAuth.User> {
    const cachedStreamCode = this.streamCache.get(streamCode);

    if (!cachedStreamCode) {
      return left(new ForbiddenException());
    }

    if (!_.includes(allowedRoles, cachedStreamCode.role)) {
      return left(new ForbiddenException('Invalid role'));
    }

    firstValueFrom(
      this.tempCodeServiceClient.deactivateOne({ id: cachedStreamCode.codeId, ids: [] }),
    )
      .then()
      .catch();

    return right(_.omit(cachedStreamCode, ['codeId']));
  }

  saveStreamCode(tempCode: NestAuth.TempCode, user: NestAuth.User): void {
    const delay = moment(tempCode.expiredAt).diff(moment(), 'milliseconds');
    this.streamCache.set(tempCode.code, { ...user, codeId: tempCode.id }, delay);
  }
}
