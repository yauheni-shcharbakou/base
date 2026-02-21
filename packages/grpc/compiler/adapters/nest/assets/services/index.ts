import { Metadata } from '@grpc/grpc-js';
import { Either } from '@sweet-monads/either';
import { Observable } from 'rxjs';

export const GRPC_ACCESS_SERVICE = Symbol('GrpcAccessService');

export interface GrpcAccessService {
  checkAccess(metadata?: Metadata, allowedRoles?: string[]): Observable<Either<Error, Metadata>>;
}
