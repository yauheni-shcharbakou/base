import { DatabaseEntity } from '@backend/common';
import { User } from '@packages/grpc.nest';

export interface UserInternal extends User, DatabaseEntity {
  salt: string;
  hash: string;
  loginAttempts: number;
}
