import { configService } from '@/common/services';
import {
  GrpcFileAdminRepository,
  GrpcImageAdminRepository,
  GrpcStorageObjectAdminRepository,
  GrpcVideoAdminRepository,
} from '@frontend/proto';

const grpcUrl = configService.getGrpcUrl();

export const fileGrpcRepository = new GrpcFileAdminRepository(grpcUrl);
export const imageGrpcRepository = new GrpcImageAdminRepository(grpcUrl);
export const storageObjectGrpcRepository = new GrpcStorageObjectAdminRepository(grpcUrl);
export const videoGrpcRepository = new GrpcVideoAdminRepository(grpcUrl);
