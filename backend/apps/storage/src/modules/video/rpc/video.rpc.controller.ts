import {
  GrpcBaseQuery,
  GrpcDownloadMap,
  GrpcGetListRequest,
  GrpcIdField,
  GrpcUploadRequest,
  GrpcUrlMap,
  GrpcVideo,
  GrpcVideoCreateRequest,
  GrpcVideoGetListResponse,
  GrpcVideoPopulated,
  GrpcVideoService,
  GrpcVideoServiceController,
  GrpcVideoUpdateByIdRequest,
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
    const ip = new GrpcMetadataMapper(metadata).get('ip');
    return from(this.videoService.getUrlMap(request, ip));
  }

  getDownloadMap(request: GrpcBaseQuery, metadata?: Metadata): Observable<GrpcDownloadMap> {
    const ip = new GrpcMetadataMapper(metadata).get('ip');
    return from(this.videoService.getDownloadMap(request, ip));
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
    request: Observable<GrpcUploadRequest>,
    metadata?: Metadata,
  ): Observable<GrpcVideoUploadResponse> {
    const userId = new GrpcMetadataMapper(metadata).get('user');
    return this.videoService.uploadOne(request, userId).pipe(GrpcRxPipe.unwrapEither);
  }

  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcVideo> {
    return from(this.videoService.deleteById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }
}
