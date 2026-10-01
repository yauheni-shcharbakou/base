'use server';

import { authService } from '@/features/auth/services';
import { runAction } from '@/features/grpc/helpers/run-action';
import {
  fileGrpcRepository,
  imageGrpcRepository,
  videoGrpcRepository,
} from '@/features/grpc/repositories';
import type { ActionResult } from '@/features/grpc/types';
import type { ClientStorage } from '@frontend/proto';

export async function createManyFiles(
  request: ClientStorage.FileCreateMany,
): Promise<ActionResult<ClientStorage.FileCreated[]>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();
    const response = await fileGrpcRepository.createMany(request, metadata);
    return response.items;
  });
}

export async function createManyImages(
  request: ClientStorage.ImageCreateMany,
): Promise<ActionResult<ClientStorage.ImageCreated[]>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();
    const response = await imageGrpcRepository.createMany(request, metadata);
    return response.items;
  });
}

export async function createManyVideos(
  request: ClientStorage.VideoCreateMany,
): Promise<ActionResult<ClientStorage.VideoCreated[]>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();
    const response = await videoGrpcRepository.createMany(request, metadata);
    return response.items;
  });
}
