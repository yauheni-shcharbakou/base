import { DatabaseEntity } from '@backend/common';
import { User } from '@packages/grpc.nest';

export interface UserSession {
  id: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface UserInternal extends User, DatabaseEntity {
  salt: string;
  hash: string;
  loginAttempts: number;
  sessions: UserSession[];
}
