import { GrpcBaseQuery, GrpcFile, GrpcFileSignedUrls, GrpcFileUpload } from '@backend/grpc';
import { HttpException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import { Observable } from 'rxjs';

export const FILE_SERVICE = Symbol('FileService');

export interface FileService {
  getSignedUrls(request: GrpcBaseQuery): Observable<GrpcFileSignedUrls>;
  uploadOne(
    request$: Observable<GrpcFileUpload>,
    user?: string,
  ): Observable<Either<Error, GrpcFile>>;
  deleteById(id: string): Observable<Either<HttpException, GrpcFile>>;
}
