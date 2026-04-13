import {
  GrpcBaseQuery,
  GrpcDownloadMap,
  GrpcFile,
  GrpcFileCreateManyRequest,
  GrpcFileCreateManyResponse,
  GrpcFileCreateRequest,
  GrpcFileGetListResponse,
  GrpcFileService,
  GrpcFileServiceClient,
  GrpcFileServiceController,
  GrpcFileUploadResponse,
  GrpcGetListRequest,
  GrpcIdField,
  GrpcUploadRequest,
  GrpcUrlMap,
} from '@backend/grpc';
import { GrpcRxPipe, InjectGrpcService, ValidateGrpcPayload } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { AdminGrpcController } from 'common/decorators/access.decorator';
import { GrpcProxyStreamMethod } from 'common/decorators/grpc-proxy-method.decorator';
import { BaseQueryDto } from 'common/dto/base-query.dto';
import { GetListRequestDto } from 'common/dto/get-list-request.dto';
import { IdFieldDto } from 'common/dto/id-field.dto';
import {
  FileCreateManyRequestDto,
  FileCreateRequestDto,
} from 'common/dto/services/storage/file.service.dto';
import { Observable, tap } from 'rxjs';

@AdminGrpcController()
@GrpcFileService.ControllerMethods()
export class FileRpcController implements GrpcFileServiceController {
  constructor(
    @InjectGrpcService(GrpcFileService.name)
    private readonly fileServiceClient: GrpcFileServiceClient,
  ) {}

  @ValidateGrpcPayload(BaseQueryDto)
  getUrlMap(request: GrpcBaseQuery, metadata?: Metadata): Observable<GrpcUrlMap> {
    return this.fileServiceClient
      .getUrlMap(request, metadata?.clone())
      .pipe(GrpcRxPipe.rpcException);
  }

  @ValidateGrpcPayload(BaseQueryDto)
  getDownloadMap(request: GrpcBaseQuery, metadata?: Metadata): Observable<GrpcDownloadMap> {
    return this.fileServiceClient
      .getDownloadMap(request, metadata?.clone())
      .pipe(GrpcRxPipe.rpcException);
  }

  @ValidateGrpcPayload(IdFieldDto)
  getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcFile> {
    return this.fileServiceClient.getById(request, metadata?.clone()).pipe(GrpcRxPipe.rpcException);
  }

  @ValidateGrpcPayload(GetListRequestDto)
  getList(request: GrpcGetListRequest, metadata?: Metadata): Observable<GrpcFileGetListResponse> {
    return this.fileServiceClient.getList(request, metadata?.clone()).pipe(GrpcRxPipe.rpcException);
  }

  @ValidateGrpcPayload(FileCreateRequestDto)
  createOne(request: GrpcFileCreateRequest, metadata?: Metadata): Observable<GrpcFile> {
    return this.fileServiceClient
      .createOne(request, metadata?.clone())
      .pipe(GrpcRxPipe.rpcException);
  }

  @ValidateGrpcPayload(FileCreateManyRequestDto)
  createMany(
    request: GrpcFileCreateManyRequest,
    metadata?: Metadata,
  ): Observable<GrpcFileCreateManyResponse> {
    return this.fileServiceClient
      .createMany(request, metadata?.clone())
      .pipe(GrpcRxPipe.rpcException);
  }

  @GrpcProxyStreamMethod()
  uploadOne(
    request: Observable<GrpcUploadRequest>,
    metadata?: Metadata,
  ): Observable<GrpcFileUploadResponse> {
    const sanitizedRequest$ = request.pipe(
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

    return this.fileServiceClient.uploadOne(sanitizedRequest$, metadata?.clone());
  }

  @ValidateGrpcPayload(IdFieldDto)
  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcFile> {
    return this.fileServiceClient
      .deleteById(request, metadata?.clone())
      .pipe(GrpcRxPipe.rpcException);
  }
}
