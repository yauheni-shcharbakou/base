'use server';

import { getErrorMessage } from '@/common/helpers';
import { authService } from '@/features/auth/services';
import {
  fileGrpcRepository,
  imageGrpcRepository,
  videoGrpcRepository,
} from '@/features/grpc/repositories';
import {
  GrpcFile,
  GrpcFileCreateManyRequest,
  GrpcImage,
  GrpcImageCreateManyRequest,
  GrpcVideo,
  GrpcVideoCreateManyRequest,
} from '@frontend/grpc';

type CreateActionResponse<T> = { data: T } | { error: string };

export async function createManyFiles(
  request: GrpcFileCreateManyRequest,
): Promise<CreateActionResponse<GrpcFile[]>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const response = await fileGrpcRepository.createMany(request, metadata);
    return { data: response.items };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function createManyImages(
  request: GrpcImageCreateManyRequest,
): Promise<CreateActionResponse<GrpcImage[]>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const response = await imageGrpcRepository.createMany(request, metadata);
    return { data: response.items };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function createManyVideos(
  request: GrpcVideoCreateManyRequest,
): Promise<CreateActionResponse<GrpcVideo[]>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const response = await videoGrpcRepository.createMany(request, metadata);
    return { data: response.items };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}
