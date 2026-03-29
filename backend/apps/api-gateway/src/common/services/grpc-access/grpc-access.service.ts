import { GrpcAuthStreamCode, GrpcTempCode, GrpcUser, GrpcUserRole } from '@backend/grpc';
import { Metadata } from '@grpc/grpc-js';
import { Either } from '@sweet-monads/either';
import { Observable } from 'rxjs';

export const GRPC_ACCESS_SERVICE = Symbol('GrpcAccessService');

export interface GrpcAccessService {
  checkAccess(
    metadata?: Metadata,
    allowedRoles?: GrpcUserRole[],
  ): Observable<Either<Error, Metadata>>;
  checkStreamAccess(metadata?: Metadata, allowedRoles?: GrpcUserRole[]): Either<Error, Metadata>;
  addStreamCode(data: GrpcTempCode, user: GrpcUser): GrpcAuthStreamCode;
}
