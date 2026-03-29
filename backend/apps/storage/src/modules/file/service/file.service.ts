import {
  GrpcBaseQuery,
  GrpcDownloadMap,
  GrpcFile,
  GrpcFileCreate,
  GrpcFileCreateManyRequest,
  GrpcFileCreateManyResponse,
  GrpcFileCreateRequest,
  GrpcFileQuery,
  GrpcFileUploadResponse,
  GrpcUploadRequest,
  GrpcUrlMap,
} from '@backend/grpc';
import { CrudService } from '@backend/persistence';
import { ProviderIdEvent } from '@backend/transport';
import { Either } from '@sweet-monads/either';
import { Observable } from 'rxjs';

export const FILE_SERVICE = Symbol('FileService');

export interface FileService extends CrudService<GrpcFile, GrpcFileQuery, GrpcFileCreate> {
  getUrlMap(request: GrpcBaseQuery, ip?: string): Promise<GrpcUrlMap>;
  getDownloadMap(request: GrpcBaseQuery, ip?: string): Promise<GrpcDownloadMap>;
  createOne(request: GrpcFileCreateRequest, userId: string): Promise<Either<Error, GrpcFile>>;
  createMany(
    request: GrpcFileCreateManyRequest,
    userId: string,
  ): Promise<Either<Error, GrpcFileCreateManyResponse>>;
  uploadOne(
    request$: Observable<GrpcUploadRequest>,
    userId?: string,
  ): Observable<Either<Error, GrpcFileUploadResponse>>;
  onDeleteOne(data: ProviderIdEvent): Promise<void>;
}
