import {
  GrpcBaseQuery,
  GrpcDownloadMap,
  GrpcUploadRequest,
  GrpcUrlMap,
  GrpcVideo,
  GrpcVideoCreate,
  GrpcVideoCreateRequest,
  GrpcVideoQuery,
  GrpcVideoUpdate,
  GrpcVideoUploadResponse,
} from '@backend/grpc';
import { CrudService } from '@backend/persistence';
import { ProviderIdEvent, VideoUpdateOneEvent } from '@backend/transport';
import { Either } from '@sweet-monads/either';
import { Observable } from 'rxjs';

export const VIDEO_SERVICE = Symbol('VideoService');

export interface VideoService extends CrudService<
  GrpcVideo,
  GrpcVideoQuery,
  GrpcVideoCreate,
  GrpcVideoUpdate
> {
  getUrlMap(request: GrpcBaseQuery, ip?: string): Promise<GrpcUrlMap>;
  getDownloadMap(request: GrpcBaseQuery, ip?: string): Promise<GrpcDownloadMap>;
  createOne(request: GrpcVideoCreateRequest, userId: string): Promise<Either<Error, GrpcVideo>>;
  uploadOne(
    request$: Observable<GrpcUploadRequest>,
    userId?: string,
  ): Observable<Either<Error, GrpcVideoUploadResponse>>;
  onDeleteOne(data: ProviderIdEvent): Promise<void>;
  onUpdateOne(data: VideoUpdateOneEvent): Promise<void>;
}
