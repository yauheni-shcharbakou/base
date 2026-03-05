import { configService } from '@/common/services';
import { GrpcFileRepository, GrpcImageRepository } from '@frontend/grpc';

const grpcUrl = configService.getGrpcUrl();

export const fileGrpcRepository = new GrpcFileRepository(grpcUrl);
export const imageGrpcRepository = new GrpcImageRepository(grpcUrl);
