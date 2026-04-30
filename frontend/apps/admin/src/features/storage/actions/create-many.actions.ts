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
  request: ClientStorage.FileCreateManyRequest,
): Promise<CreateActionResponse<ClientStorage.File[]>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const response = await fileGrpcRepository.createMany(request, metadata);
    return { data: response.items };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function createManyImages(
  request: ClientStorage.ImageCreateManyRequest,
): Promise<CreateActionResponse<ClientStorage.Image[]>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const response = await imageGrpcRepository.createMany(request, metadata);
    return { data: response.items };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

export async function createManyVideos(
  request: ClientStorage.VideoCreateManyRequest,
): Promise<CreateActionResponse<ClientStorage.Video[]>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const response = await videoGrpcRepository.createMany(request, metadata);
    return { data: response.items };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}
