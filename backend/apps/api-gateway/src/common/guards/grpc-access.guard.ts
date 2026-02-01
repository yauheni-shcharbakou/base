import { GrpcAuthService, GrpcAuthServiceClient, GrpcUserRole } from '@backend/grpc';
import { GrpcRxPipe, InjectGrpcService } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MetadataAccessType, MetadataKey } from 'common/enums/metadata.enums';
import { map, Observable } from 'rxjs';

@Injectable()
export class GrpcAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectGrpcService(GrpcAuthService.name)
    private readonly authServiceClient: GrpcAuthServiceClient,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const contextType = context.getType();

    if (contextType !== 'rpc') {
      return true;
    }

    const accessType = this.reflector.getAllAndOverride<MetadataAccessType>(
      MetadataKey.ACCESS_TYPE,
      [context.getHandler(), context.getClass()],
    );

    if (accessType === MetadataAccessType.PUBLIC) {
      return true;
    }

    try {
      const metadata = context.switchToRpc().getContext<Metadata>();
      const [accessToken] = metadata.get('access-token') as string[];

      return this.authServiceClient.me({ accessToken }).pipe(
        map((user) => {
          if (accessType === MetadataAccessType.ADMIN && user.role !== GrpcUserRole.ADMIN) {
            throw new UnauthorizedException('Only admin can use this endpoint');
          }

          return true;
        }),
        GrpcRxPipe.rpcException,
      );
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
}
