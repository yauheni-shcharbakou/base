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
  GrpcFileCreateRequest,
  GrpcImage,
  GrpcImageCreateRequest,
  GrpcVideo,
  GrpcVideoCreateRequest,
} from '@frontend/grpc';

type CreateActionResponse<T> = { entity: T } | { error: string };

export async function createFile(
  request: GrpcFileCreateRequest,
): Promise<CreateActionResponse<GrpcFile>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const entity = await fileGrpcRepository.createOne(request, metadata);
    return { entity };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function createVideo(
  request: GrpcVideoCreateRequest,
): Promise<CreateActionResponse<GrpcVideo>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const entity = await videoGrpcRepository.createOne(request, metadata);
    return { entity };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function createImage(
  request: GrpcImageCreateRequest,
): Promise<CreateActionResponse<GrpcImage>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const entity = await imageGrpcRepository.createOne(request, metadata);
    return { entity };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}
