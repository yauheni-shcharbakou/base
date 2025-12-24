import { StatusObject } from '@grpc/grpc-js';
import Long from 'long';

export type GrpcExceptionResponse = Omit<StatusObject, 'metadata'>;

export type GrpcTimestamp = {
  seconds: Long | string;
  nanos?: string | number;
};
