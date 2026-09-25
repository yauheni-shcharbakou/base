import { GrpcRxPipe, InjectGrpcService } from '@backend/grpc';
import { GrpcFileServiceClient, GrpcFileTransport, NestCommon, NestStorage } from '@backend/proto';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { FileMapper } from '../mappers/file.mapper';

@Injectable()
export class FileProxyService {
  constructor(
    @InjectGrpcService(GrpcFileTransport.service)
    private readonly fileClient: GrpcFileServiceClient,
    private readonly fileMapper: FileMapper,
  ) {}

  getUrlMap(query: NestCommon.Query, ip?: string, userId?: string): Promise<NestCommon.StringMap> {
    return firstValueFrom(
      this.fileClient.getUrlMap({ ...query, userId, ip }).pipe(GrpcRxPipe.rpcException),
    );
  }

  getDownloadMap(
    query: NestCommon.Query,
    ip?: string,
    userId?: string,
  ): Promise<NestStorage.DownloadMap> {
    return firstValueFrom(
      this.fileClient.getDownloadMap({ ...query, userId, ip }).pipe(GrpcRxPipe.rpcException),
    );
  }

  getById(id: string): Promise<NestStorage.File> {
    return firstValueFrom(this.fileClient.getById({ id }).pipe(GrpcRxPipe.rpcException));
  }

  getList(request: NestCommon.GetList): Promise<NestStorage.FileList> {
    return firstValueFrom(this.fileClient.getList(request).pipe(GrpcRxPipe.rpcException));
  }

  createOne(request: NestStorage.FileCreateOne): Promise<NestStorage.FileCreated> {
    return firstValueFrom(this.fileClient.createOne(request).pipe(GrpcRxPipe.rpcException));
  }

  createMany(request: NestStorage.FileCreateMany): Promise<NestStorage.FileCreatedArray> {
    return firstValueFrom(this.fileClient.createMany(request).pipe(GrpcRxPipe.rpcException));
  }

  completeUpload(id: string, userId?: string): Promise<NestStorage.File> {
    return firstValueFrom(
      this.fileClient.completeUpload({ id, userId }).pipe(GrpcRxPipe.rpcException),
    );
  }

  deleteOne(query: Partial<NestStorage.FileQuery>): Promise<NestStorage.File> {
    const requestQuery: NestStorage.FileQuery = this.fileMapper.transformQuery(query);
    return firstValueFrom(this.fileClient.deleteOne(requestQuery).pipe(GrpcRxPipe.rpcException));
  }
}
