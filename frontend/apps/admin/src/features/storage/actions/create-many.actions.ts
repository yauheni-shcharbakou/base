'use server';

import { getErrorMessage } from '@/common/helpers';
import { authService } from '@/features/auth/services';
import {
  fileGrpcRepository,
  imageGrpcRepository,
  videoGrpcRepository,
} from '@/features/grpc/repositories';
import type { ClientStorage } from '@frontend/proto';

type CreateActionResponse<T> = { data: T } | { error: string };

export async function createManyFiles(
  request: ClientStorage.FileCreateMany,
): Promise<CreateActionResponse<ClientStorage.FileCreated[]>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const response = await fileGrpcRepository.createMany(request, metadata);
    return { data: response.items };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function createManyImages(
  request: ClientStorage.ImageCreateMany,
): Promise<CreateActionResponse<ClientStorage.ImageCreated[]>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const response = await imageGrpcRepository.createMany(request, metadata);
    return { data: response.items };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function createManyVideos(
  request: ClientStorage.VideoCreateMany,
): Promise<CreateActionResponse<ClientStorage.VideoCreated[]>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const response = await videoGrpcRepository.createMany(request, metadata);
    return { data: response.items };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}
