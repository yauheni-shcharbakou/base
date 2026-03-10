import {
  GrpcBaseQuery,
  GrpcDownloadMap,
  GrpcUrlMap,
  GrpcVideo,
  GrpcVideoCreate,
  GrpcVideoCreateRequest,
  GrpcVideoQuery,
  GrpcVideoUpdate,
  GrpcVideoUploadRequest,
  GrpcVideoUploadResponse,
} from '@backend/grpc';
import { CrudService } from '@backend/persistence';
import { Either } from '@sweet-monads/either';
import { Observable } from 'rxjs';

export const VIDEO_SERVICE = Symbol('VideoService');

export interface VideoService extends CrudService<
  GrpcVideo,
  GrpcVideoQuery,
  GrpcVideoCreate,
  GrpcVideoUpdate
> {
  getUrlMap(request: GrpcBaseQuery): Promise<GrpcUrlMap>;
  getDownloadMap(request: GrpcBaseQuery): Promise<GrpcDownloadMap>;
  createOne(request: GrpcVideoCreateRequest, userId: string): Promise<Either<Error, GrpcVideo>>;
  uploadOne(
    request$: Observable<GrpcVideoUploadRequest>,
    userId?: string,
  ): Observable<Either<Error, GrpcVideoUploadResponse>>;
}
