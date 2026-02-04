import { config } from '@/config';
import { GrpcAuthRepository, GrpcUserRepository } from '@frontend/grpc';

export const authGrpcRepository = new GrpcAuthRepository(config.backend.grpcUrl);
export const userGrpcRepository = new GrpcUserRepository(config.backend.grpcUrl);
