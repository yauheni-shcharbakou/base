import { GrpcRxPipe, InjectGrpcService } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_SERVICE_NAME, AuthServiceClient, UserRole } from '@backend/grpc';
import { MetadataAccessType, MetadataKey } from 'common/enums/metadata.enums';
import { map, Observable } from 'rxjs';

@Injectable()
export class GrpcAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectGrpcService(AUTH_SERVICE_NAME) private readonly authServiceClient: AuthServiceClient,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const contextType = context.getType();

    if (contextType !== 'rpc') {
      return true;
    }

    const accessType = this.reflector.getAllAndOverride<MetadataAccessType>(
      MetadataKey.ACCESS_TYPE,
      [context.getClass(), context.getHandler()],
    );

    if (accessType === MetadataAccessType.PUBLIC) {
      return true;
    }

    try {
      const metadata = context.switchToRpc().getContext<Metadata>();
      const [accessToken] = metadata.get('access-token') as string[];

      return this.authServiceClient.me({ accessToken }).pipe(
        map((user) => {
          return accessType === MetadataAccessType.ADMIN ? user.role === UserRole.ADMIN : !!user;
        }),
        GrpcRxPipe.rpcException,
      );
    } catch (e) {
      throw new UnauthorizedException();
    }
  }
}
