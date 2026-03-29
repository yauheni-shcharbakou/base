import { CrudService } from '@backend/persistence';
import { GrpcBaseQuery, GrpcIdField, GrpcTempCode, GrpcTempCodeCreate } from '@backend/grpc';

export const TEMP_CODE_SERVICE = Symbol('TempCodeService');

export interface TempCodeService extends CrudService<
  GrpcTempCode,
  GrpcBaseQuery,
  GrpcTempCodeCreate
> {
  onDeactivateOne(event: GrpcIdField): Promise<void>;
}
