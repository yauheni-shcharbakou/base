import { GRPC_ACCESS_SERVICE, GrpcAccessService, GrpcUserRole } from '@backend/grpc';
import { GrpcRxPipe } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MetadataKey } from 'common/enums/metadata.enums';
import _ from 'lodash';
import { map, Observable } from 'rxjs';

@Injectable()
export class GrpcAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(GRPC_ACCESS_SERVICE) private readonly accessService: GrpcAccessService,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const contextType = context.getType();

    if (contextType !== 'rpc') {
      return true;
    }

    const skipAuth = this.reflector.getAllAndOverride<boolean>(MetadataKey.SKIP_AUTH, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipAuth) {
      return true;
    }

    const allowedRoles = this.reflector.getAllAndOverride<GrpcUserRole[]>(
      MetadataKey.ALLOWED_ROLES,
      [context.getHandler(), context.getClass()],
    );

    const metadata = context.switchToRpc().getContext<Metadata>();

    return this.accessService.checkAccess(metadata, allowedRoles ?? _.values(GrpcUserRole)).pipe(
      map((meta) => {
        if (meta.isLeft()) {
          throw meta.value;
        }

        return !!meta.value;
      }),
      GrpcRxPipe.rpcException,
    );
  }
}
