import {
  GrpcBaseQuery,
  GrpcFile,
  GrpcFileCreateRequest,
  GrpcFileQuery,
  GrpcFileSignedUrls,
  GrpcFileUploadRequest,
  GrpcFileUploadResponse,
} from '@backend/grpc';
import { CrudService } from '@backend/persistence';
import { Either } from '@sweet-monads/either';
import { FileCreate } from 'common/repositories/file/file.repository';
import { Observable } from 'rxjs';

export const FILE_SERVICE = Symbol('FileService');

export interface FileService extends CrudService<GrpcFile, GrpcFileQuery, FileCreate> {
  getSignedUrls(request: GrpcBaseQuery): Promise<GrpcFileSignedUrls>;
  createOne(request: GrpcFileCreateRequest, user: string): Promise<Either<Error, GrpcFile>>;
  uploadOne(
    request$: Observable<GrpcFileUploadRequest>,
    user?: string,
  ): Observable<Either<Error, GrpcFileUploadResponse>>;
}
