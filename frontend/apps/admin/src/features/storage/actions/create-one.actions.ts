'use server';

import { getErrorMessage } from '@/common/helpers';
import { authService } from '@/features/auth/services';
import {
  fileGrpcRepository,
  imageGrpcRepository,
  videoGrpcRepository,
} from '@/features/grpc/repositories';
import type { ClientStorage } from '@frontend/proto';

type CreateActionResponse<T> = { entity: T } | { error: string };

export async function createFile(
  request: ClientStorage.FileCreateRequest,
): Promise<CreateActionResponse<ClientStorage.File>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const entity = await fileGrpcRepository.createOne(request, metadata);
    return { entity };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function createVideo(
  request: ClientStorage.VideoCreateRequest,
): Promise<CreateActionResponse<ClientStorage.Video>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const entity = await videoGrpcRepository.createOne(request, metadata);
    return { entity };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function createImage(
  request: ClientStorage.ImageCreateRequest,
): Promise<CreateActionResponse<ClientStorage.Image>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const entity = await imageGrpcRepository.createOne(request, metadata);
    return { entity };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}
