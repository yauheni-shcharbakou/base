import { GrpcDataMapper } from '@/features/grpc/mappers/grpc.data.mapper';
import { GrpcErrorMapper } from '@/features/grpc/mappers/grpc.error.mapper';

export const grpcDataMapper = new GrpcDataMapper();
export const grpcErrorMapper = new GrpcErrorMapper();
