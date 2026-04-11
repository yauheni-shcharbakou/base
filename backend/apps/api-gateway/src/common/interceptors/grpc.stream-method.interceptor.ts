import { GrpcUserRole } from '@backend/grpc';
import { GrpcExceptionMapper, GrpcRxPipe } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MetadataKey } from 'common/enums/metadata.enums';
import {
  GRPC_ACCESS_SERVICE,
  GrpcAccessService,
} from 'common/services/grpc-access/grpc-access.service';
import _ from 'lodash';
import { isObservable, Observable, throwError } from 'rxjs';

@Injectable()
export class GrpcStreamMethodInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(GRPC_ACCESS_SERVICE) private readonly accessService: GrpcAccessService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType();

    if (contextType !== 'rpc') {
      return next.handle();
    }

    const rpc = context.switchToRpc();

    if (!isObservable(rpc.getData())) {
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

    const meta = this.accessService.checkStreamAccess(
      metadata,
      allowedRoles ?? _.values(GrpcUserRole),
    );

    if (meta.isLeft()) {
      return throwError(() => GrpcExceptionMapper.toRpcException(meta.value));
    }

    return next.handle().pipe(GrpcRxPipe.rpcException);
  }
}
