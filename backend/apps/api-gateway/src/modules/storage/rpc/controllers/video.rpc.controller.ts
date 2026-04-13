import {
  GrpcBaseQuery,
  GrpcDownloadMap,
  GrpcGetListRequest,
  GrpcIdField,
  GrpcUploadRequest,
  GrpcUrlMap,
  GrpcVideo,
  GrpcVideoCreateManyRequest,
  GrpcVideoCreateManyResponse,
  GrpcVideoCreateRequest,
  GrpcVideoGetListResponse,
  GrpcVideoPopulated,
  GrpcVideoService,
  GrpcVideoServiceClient,
  GrpcVideoServiceController,
  GrpcVideoUpdateByIdRequest,
  GrpcVideoUploadResponse,
} from '@backend/grpc';
import { GrpcRxPipe, InjectGrpcService, ValidateGrpcPayload } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { AdminGrpcController } from 'common/decorators/access.decorator';
import { GrpcProxyStreamMethod } from 'common/decorators/grpc-proxy-method.decorator';
import { BaseQueryDto } from 'common/dto/base-query.dto';
import { GetListRequestDto } from 'common/dto/get-list-request.dto';
import { IdFieldDto } from 'common/dto/id-field.dto';
import {
  VideoCreateManyRequestDto,
  VideoCreateRequestDto,
  VideoUpdateByIdRequestDto,
} from 'common/dto/services/storage/video.service.dto';
import { Observable, tap } from 'rxjs';

@AdminGrpcController()
@GrpcVideoService.ControllerMethods()
export class VideoRpcController implements GrpcVideoServiceController {
  constructor(
    @InjectGrpcService(GrpcVideoService.name)
    private readonly videoServiceClient: GrpcVideoServiceClient,
  ) {}

  @ValidateGrpcPayload(BaseQueryDto)
  getUrlMap(request: GrpcBaseQuery, metadata?: Metadata): Observable<GrpcUrlMap> {
    return this.videoServiceClient
      .getUrlMap(request, metadata?.clone())
      .pipe(GrpcRxPipe.rpcException);
  }

  @ValidateGrpcPayload(BaseQueryDto)
  getDownloadMap(request: GrpcBaseQuery, metadata?: Metadata): Observable<GrpcDownloadMap> {
    return this.videoServiceClient
      .getDownloadMap(request, metadata?.clone())
      .pipe(GrpcRxPipe.rpcException);
  }

  @ValidateGrpcPayload(IdFieldDto)
  getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcVideoPopulated> {
    return this.videoServiceClient
      .getById(request, metadata?.clone())
      .pipe(GrpcRxPipe.rpcException);
  }

  @ValidateGrpcPayload(GetListRequestDto)
  getList(request: GrpcGetListRequest, metadata?: Metadata): Observable<GrpcVideoGetListResponse> {
    return this.videoServiceClient
      .getList(request, metadata?.clone())
      .pipe(GrpcRxPipe.rpcException);
  }

  @ValidateGrpcPayload(VideoCreateRequestDto)
  createOne(request: GrpcVideoCreateRequest, metadata?: Metadata): Observable<GrpcVideo> {
    return this.videoServiceClient
      .createOne(request, metadata?.clone())
      .pipe(GrpcRxPipe.rpcException);
  }

  @ValidateGrpcPayload(VideoCreateManyRequestDto)
  createMany(
    request: GrpcVideoCreateManyRequest,
    metadata?: Metadata,
  ): Observable<GrpcVideoCreateManyResponse> {
    return this.videoServiceClient
      .createMany(request, metadata?.clone())
      .pipe(GrpcRxPipe.rpcException);
  }

  @ValidateGrpcPayload(VideoUpdateByIdRequestDto)
  updateById(request: GrpcVideoUpdateByIdRequest, metadata?: Metadata): Observable<GrpcVideo> {
    return this.videoServiceClient
      .updateById(request, metadata?.clone())
      .pipe(GrpcRxPipe.rpcException);
  }

  @GrpcProxyStreamMethod()
  uploadOne(
    request: Observable<GrpcUploadRequest>,
    metadata?: Metadata,
  ): Observable<GrpcVideoUploadResponse> {
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

    return this.videoServiceClient.uploadOne(sanitizedRequest$, metadata?.clone());
  }

  @ValidateGrpcPayload(IdFieldDto)
  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcVideo> {
    return this.videoServiceClient
      .deleteById(request, metadata?.clone())
      .pipe(GrpcRxPipe.rpcException);
  }
}
