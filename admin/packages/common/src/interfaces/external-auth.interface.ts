import { UserRole } from '@packages/grpc.js';

export interface ExternalUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface ExternalAuthResponse {
  user:
    | (ExternalUser & {
        _verified: boolean;
        createdAt: Date;
        updatedAt: Date;
        _strategy: 'local-jwt';
      })
    | null;
  collection: string;
  token?: string;
  exp?: number;
}

export interface ExternalAuthResult {
  user: ExternalUser;
  collection: string;
}
