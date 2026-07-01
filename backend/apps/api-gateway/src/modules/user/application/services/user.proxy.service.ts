import { GrpcRxPipe, InjectGrpcService } from '@backend/grpc';
import { GrpcUserServiceClient, GrpcUserTransport, NestAuth, NestCommon } from '@backend/proto';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class UserProxyService {
  constructor(
    @InjectGrpcService(GrpcUserTransport.service)
    private readonly userClient: GrpcUserServiceClient,
  ) {}

  getById(id: string): Promise<NestAuth.User> {
    return firstValueFrom(this.userClient.getById({ id }).pipe(GrpcRxPipe.rpcException));
  }

  getList(request: NestCommon.GetList): Promise<NestAuth.UserList> {
    return firstValueFrom(this.userClient.getList(request).pipe(GrpcRxPipe.rpcException));
  }

  createOne(request: NestAuth.UserCreate): Promise<NestAuth.User> {
    return firstValueFrom(this.userClient.createOne(request).pipe(GrpcRxPipe.rpcException));
  }

  updateById(id: string, updateData: NestAuth.UserUpdate): Promise<NestAuth.User> {
    return firstValueFrom(
      this.userClient.updateById({ id, update: updateData }).pipe(GrpcRxPipe.rpcException),
    );
  }

  deleteById(id: string): Promise<NestAuth.User> {
    return firstValueFrom(this.userClient.deleteById({ id }).pipe(GrpcRxPipe.rpcException));
  }
}
