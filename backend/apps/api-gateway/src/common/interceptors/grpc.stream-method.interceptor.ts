import { GrpcUserRole } from '@backend/grpc';
import { GrpcExceptionMapper } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MetadataKey } from 'common/enums/metadata.enums';
import {
  GRPC_ACCESS_SERVICE,
  GrpcAccessService,
} from 'common/services/grpc-access/grpc-access.service';
import _ from 'lodash';
import { catchError, isObservable, map, Observable, switchMap, throwError } from 'rxjs';

@Injectable()
export class GrpcStreamMethodInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(GRPC_ACCESS_SERVICE) private readonly accessService: GrpcAccessService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType();
    const rpc = context.switchToRpc();
    const data$ = rpc.getData();

    if (contextType !== 'rpc' || !isObservable(data$)) {
      return next.handle();
    }

    const skipAuth = this.reflector.getAllAndOverride<boolean>(MetadataKey.SKIP_AUTH, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipAuth) {
      return next.handle();
    }

    const allowedRoles = this.reflector.getAllAndOverride<GrpcUserRole[]>(
      MetadataKey.ALLOWED_ROLES,
      [context.getHandler(), context.getClass()],
    );

    const metadata = rpc.getContext<Metadata>();

    return this.accessService.checkAccess(metadata, allowedRoles ?? _.values(GrpcUserRole)).pipe(
      map((meta) => {
        if (meta.isLeft()) {
          throw meta.value;
        }

        return meta.value;
      }),
      switchMap((meta) => {
        rpc.getContext = () => meta as any;
        return next.handle();
      }),
      catchError((err) => {
        return throwError(() => GrpcExceptionMapper.toRpcException(err));
      }),
    );
  }
}
