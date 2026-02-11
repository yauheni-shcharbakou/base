import { GrpcFile, GrpcFileUpload } from '@backend/grpc';
import { Either } from '@sweet-monads/either';
import { Observable } from 'rxjs';

export const FILE_SERVICE = Symbol('FileService');

export interface FileService {
  uploadOne(stream$: Observable<GrpcFileUpload>): Observable<Either<Error, GrpcFile>>;
}
