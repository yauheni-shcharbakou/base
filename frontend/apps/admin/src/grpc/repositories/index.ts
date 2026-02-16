import { configService } from '@/services';
import { GrpcFileRepository } from '@frontend/grpc';

export const fileGrpcRepository = new GrpcFileRepository(configService.getGrpcUrl());
