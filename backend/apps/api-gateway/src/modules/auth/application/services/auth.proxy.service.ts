import { GrpcRxPipe, InjectGrpcService } from '@backend/grpc';
import { GrpcAuthServiceClient, GrpcAuthTransport, NestAuth } from '@backend/proto';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthProxyService {
  constructor(
    @InjectGrpcService(GrpcAuthTransport.service)
    private readonly authClient: GrpcAuthServiceClient,
  ) {}

  login(request: NestAuth.AuthLogin): Promise<NestAuth.AuthData> {
    return firstValueFrom(this.authClient.login(request).pipe(GrpcRxPipe.rpcException));
  }

  refreshToken(request: NestAuth.AuthRefresh): Promise<NestAuth.AuthData> {
    return firstValueFrom(this.authClient.refreshToken(request).pipe(GrpcRxPipe.rpcException));
  }

  me(request: NestAuth.AuthMe): Promise<NestAuth.User> {
    return firstValueFrom(this.authClient.me(request).pipe(GrpcRxPipe.rpcException));
  }
}
