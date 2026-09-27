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

export async function createFile(
  request: ClientStorage.FileCreateOne,
): Promise<ActionResult<ClientStorage.FileCreated>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();
    return fileGrpcRepository.createOne(request, metadata);
  });
}

export async function createVideo(
  request: ClientStorage.VideoCreateOne,
): Promise<ActionResult<ClientStorage.VideoCreated>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();
    return videoGrpcRepository.createOne(request, metadata);
  });
}

export async function createImage(
  request: ClientStorage.ImageCreateOne,
): Promise<ActionResult<ClientStorage.ImageCreated>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();
    return imageGrpcRepository.createOne(request, metadata);
  });
}
