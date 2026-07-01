import { GrpcRxPipe } from '@backend/grpc';
import { NestAuth } from '@backend/proto';
import { MetadataKey } from '@common/domain/enums/metadata.enums';
import { AccessService } from '@common/domain/services/access.service';
import { Metadata, status } from '@grpc/grpc-js';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RpcException } from '@nestjs/microservices';
import _ from 'lodash';
import { isObservable, map, Observable } from 'rxjs';

@Injectable()
export class GrpcAccessUnaryGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessService: AccessService,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const contextType = context.getType();
    const rpc = context.switchToRpc();

    if (contextType !== 'rpc' || isObservable(rpc.getData())) {
      return true;
    }

    const skipAuth = this.reflector.getAllAndOverride<boolean>(MetadataKey.SKIP_AUTH, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipAuth) {
      return true;
    }

    const isStreamMethod = this.reflector.getAllAndOverride<boolean>(MetadataKey.IS_STREAM_METHOD, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isStreamMethod) {
      return true;
    }

    const allowedRoles =
      this.reflector.getAllAndOverride<NestAuth.UserRole[]>(MetadataKey.ALLOWED_ROLES, [
        context.getHandler(),
        context.getClass(),
      ]) ?? _.values(NestAuth.UserRole);

    const metadata = rpc.getContext<Metadata>();
    const accessToken = metadata?.get('access-token')?.[0]?.toString();

    if (!accessToken) {
      throw new RpcException({ code: status.UNAUTHENTICATED, details: 'Access token is missing' });
    }

    return this.accessService.checkUnaryAccess(accessToken, allowedRoles).pipe(
      map((user) => {
        if (user.isLeft()) {
          throw user.value;
        }

        metadata.set('userId', user.value.id);
        return !!user.value;
      }),
      GrpcRxPipe.rpcException,
    );
  }
}
