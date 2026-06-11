import { NestCommon } from '@backend/proto';
import { MigrationStatus } from '../enums';

export interface Migration extends NestCommon.Entity {
  name: string;
  status: MigrationStatus;
  errorMessage?: string;
  errorStack?: string;
}
