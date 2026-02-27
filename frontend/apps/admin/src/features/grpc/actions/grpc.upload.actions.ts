'use server';

import { authService } from '@/features/auth/services';
import { fileGrpcRepository } from '@/features/grpc/repositories';
import { GrpcFile, GrpcFileCreateRequest } from '@frontend/grpc';

export async function createFile(request: GrpcFileCreateRequest): Promise<GrpcFile> {
  const metadata = await authService.getAuthMetadata();
  return fileGrpcRepository.createOne(request, metadata);
}
