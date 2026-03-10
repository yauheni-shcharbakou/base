import {
  GrpcBaseQuery,
  GrpcDownloadMap,
  GrpcGetListRequest,
  GrpcIdField,
  GrpcUrlMap,
  GrpcVideo,
  GrpcVideoCreateRequest,
  GrpcVideoGetListResponse,
  GrpcVideoPopulated,
  GrpcVideoService,
  GrpcVideoServiceController,
  GrpcVideoUpdateByIdRequest,
  GrpcVideoUploadRequest,
  GrpcVideoUploadResponse,
} from '@backend/grpc';
import { GrpcController, GrpcMetadataMapper, GrpcRxPipe } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { Inject } from '@nestjs/common';
import { VIDEO_SERVICE, VideoService } from 'modules/video/service/video.service';
import { from, Observable } from 'rxjs';

@GrpcController()
@GrpcVideoService.ControllerMethods()
export class VideoRpcController implements GrpcVideoServiceController {
  constructor(@Inject(VIDEO_SERVICE) private readonly videoService: VideoService) {}

  getUrlMap(request: GrpcBaseQuery, metadata?: Metadata): Observable<GrpcUrlMap> {
    return from(this.videoService.getUrlMap(request));
  }

  getDownloadMap(request: GrpcBaseQuery, metadata?: Metadata): Observable<GrpcDownloadMap> {
    return from(this.videoService.getDownloadMap(request));
  }

  getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcVideoPopulated> {
    return from(
      this.videoService.getById<GrpcVideoPopulated>(request.id, { populate: ['file'] }),
    ).pipe(GrpcRxPipe.unwrapEither);
  }

  getList(request: GrpcGetListRequest, metadata?: Metadata): Observable<GrpcVideoGetListResponse> {
    return from(this.videoService.getList<GrpcVideoPopulated>(request, { populate: ['file'] }));
  }

  createOne(request: GrpcVideoCreateRequest, metadata?: Metadata): Observable<GrpcVideo> {
    const userId = new GrpcMetadataMapper(metadata).getOrThrow('user');
    return from(this.videoService.createOne(request, userId)).pipe(GrpcRxPipe.unwrapEither);
  }

  updateById(
    request: GrpcVideoUpdateByIdRequest,
    metadata?: Metadata,
  ): Promise<GrpcVideo> | Observable<GrpcVideo> | GrpcVideo {
    const stream$ = from(this.videoService.updateById(request.id, request.update));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  uploadOne(
    request: Observable<GrpcVideoUploadRequest>,
    metadata?: Metadata,
  ): Observable<GrpcVideoUploadResponse> {
    const userId = new GrpcMetadataMapper(metadata).get('user');
    return this.videoService.uploadOne(request, userId).pipe(GrpcRxPipe.unwrapEither);
  }
}
