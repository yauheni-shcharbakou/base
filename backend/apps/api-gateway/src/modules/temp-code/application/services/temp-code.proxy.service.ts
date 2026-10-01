import { GrpcRxPipe, InjectGrpcService } from '@backend/grpc';
import {
  GrpcTempCodeServiceClient,
  GrpcTempCodeTransport,
  NestAuth,
  NestCommon,
} from '@backend/proto';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TempCodeProxyService {
  constructor(
    @InjectGrpcService(GrpcTempCodeTransport.service)
    private readonly tempCodeClient: GrpcTempCodeServiceClient,
  ) {}

  getById(id: string): Promise<NestAuth.TempCode> {
    return firstValueFrom(this.tempCodeClient.getById({ id }).pipe(GrpcRxPipe.rpcException));
  }

  getList(request: NestCommon.GetList): Promise<NestAuth.TempCodeList> {
    return firstValueFrom(this.tempCodeClient.getList(request).pipe(GrpcRxPipe.rpcException));
  }

  createOne(request: NestAuth.TempCodeCreate): Promise<NestAuth.TempCode> {
    return firstValueFrom(this.tempCodeClient.createOne(request).pipe(GrpcRxPipe.rpcException));
  }

  deactivateOne(query: NestAuth.TempCodeQuery): Promise<NestAuth.TempCode> {
    return firstValueFrom(this.tempCodeClient.deactivateOne(query).pipe(GrpcRxPipe.rpcException));
  }

  deleteById(id: string): Promise<NestAuth.TempCode> {
    return firstValueFrom(this.tempCodeClient.deleteById({ id }).pipe(GrpcRxPipe.rpcException));
  }
}
