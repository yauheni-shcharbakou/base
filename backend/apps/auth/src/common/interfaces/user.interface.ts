import { User } from '@backend/grpc';

export interface UserInternal extends User {
  hash: string;
}
