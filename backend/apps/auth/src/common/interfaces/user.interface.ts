import { GrpcUser } from '@backend/grpc';

export interface User extends GrpcUser {
  hash: string;
}
