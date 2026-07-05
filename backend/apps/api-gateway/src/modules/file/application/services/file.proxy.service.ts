import { GrpcRxPipe, InjectGrpcService } from '@backend/grpc';
import { GrpcFileServiceClient, GrpcFileTransport, NestCommon, NestStorage } from '@backend/proto';
import { Injectable } from '@nestjs/common';
import { firstValueFrom, map, Observable, tap } from 'rxjs';
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

  createOne(request: NestStorage.FileCreateOne): Promise<NestStorage.File> {
    return firstValueFrom(this.fileClient.createOne(request).pipe(GrpcRxPipe.rpcException));
  }

  createMany(request: NestStorage.FileCreateMany): Promise<NestStorage.FileArray> {
    return firstValueFrom(this.fileClient.createMany(request).pipe(GrpcRxPipe.rpcException));
  }

  uploadOne(
    request$: Observable<NestStorage.UploadOneShort>,
    userId?: string,
  ): Observable<NestStorage.FileUploadResponse> {
    const sanitizedRequest$ = request$.pipe(
      map((message: NestStorage.UploadOne) => {
        if (message.filter && userId) {
          message.filter.userId = userId;
        }

        return message;
      }),
      tap({
        next: (message) => {
          if (message.chunk) {
            setTimeout(() => {
              delete message.chunk;
            }, 0);
          }
        },
      }),
    );

    return this.fileClient.uploadOne(sanitizedRequest$);
  }

  deleteOne(query: Partial<NestStorage.FileQuery>): Promise<NestStorage.File> {
    const requestQuery: NestStorage.FileQuery = this.fileMapper.transformQuery(query);
    return firstValueFrom(this.fileClient.deleteOne(requestQuery).pipe(GrpcRxPipe.rpcException));
  }
}
