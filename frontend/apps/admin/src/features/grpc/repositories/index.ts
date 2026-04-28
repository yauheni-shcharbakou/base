import { configService } from '@/common/services';
import {
  GrpcFileRepository,
  GrpcImageRepository,
  GrpcStorageObjectRepository,
  GrpcVideoRepository,
} from '@frontend/proto';

const grpcUrl = configService.getGrpcUrl();

export const fileGrpcRepository = new GrpcFileRepository(grpcUrl);
export const imageGrpcRepository = new GrpcImageRepository(grpcUrl);
export const storageObjectGrpcRepository = new GrpcStorageObjectRepository(grpcUrl);
export const videoGrpcRepository = new GrpcVideoRepository(grpcUrl);
