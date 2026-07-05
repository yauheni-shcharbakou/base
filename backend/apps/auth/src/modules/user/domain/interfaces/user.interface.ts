import { NestAuth } from '@backend/proto';

export interface User extends NestAuth.User {
  hash: string;
}
