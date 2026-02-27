import { GrpcFile, GrpcFileUploadRequest } from '@backend/grpc';
import { Metadata } from '@grpc/grpc-js';
import { Either } from '@sweet-monads/either';
import { Observable } from 'rxjs';

export const STORAGE_SERVICE = Symbol('StorageService');

export interface StorageService {
  // uploadFile(
  //   request$: Observable<GrpcFileUploadRequest>,
  //   metadata?: Metadata,
  // ): Observable<Either<Error, GrpcFile>>;
}
