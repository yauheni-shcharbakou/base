import { GrpcRxPipe, InjectGrpcService } from '@backend/grpc';
import {
  GrpcTempCodeServiceClient,
  GrpcTempCodeTransport,
  NestAuth,
  NestCommon,
} from '@backend/proto';
import { AccessService } from '@common/domain/services/access.service';
import { UserProxyService } from '@modules/user/application/services/user.proxy.service';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TempCodeProxyService {
  constructor(
    @InjectGrpcService(GrpcTempCodeTransport.service)
    private readonly tempCodeClient: GrpcTempCodeServiceClient,
    private readonly userProxyService: UserProxyService,
    private readonly accessService: AccessService,
  ) {}

  getById(id: string): Promise<NestAuth.TempCode> {
    return firstValueFrom(this.tempCodeClient.getById({ id }).pipe(GrpcRxPipe.rpcException));
  }

  getList(request: NestCommon.GetList): Promise<NestAuth.TempCodeList> {
    return firstValueFrom(this.tempCodeClient.getList(request).pipe(GrpcRxPipe.rpcException));
  }

  async createOne(request: NestAuth.TempCodeCreate): Promise<NestAuth.TempCode> {
    const [tempCode, user] = await Promise.all([
      firstValueFrom(this.tempCodeClient.createOne(request).pipe(GrpcRxPipe.rpcException)),
      this.userProxyService.getById(request.user),
    ]);

    this.accessService.saveStreamCode(tempCode, user);
    return tempCode;
  }

  deactivateOne(query: NestAuth.TempCodeQuery): Promise<NestAuth.TempCode> {
    return firstValueFrom(this.tempCodeClient.deactivateOne(query).pipe(GrpcRxPipe.rpcException));
  }

  deleteById(id: string): Promise<NestAuth.TempCode> {
    return firstValueFrom(this.tempCodeClient.deleteById({ id }).pipe(GrpcRxPipe.rpcException));
  }
}
