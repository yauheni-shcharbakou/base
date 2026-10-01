'use server';

import { authService } from '@/features/auth/services';
import { runAction } from '@/features/grpc/helpers/run-action';
import { fileGrpcRepository } from '@/features/grpc/repositories';
import type { ActionResult } from '@/features/grpc/types';
import type { ClientStorage } from '@frontend/proto';

/** Confirms a direct upload: the backend checks the stored size and turns the file READY. */
export async function completeFileUpload(id: string): Promise<ActionResult<ClientStorage.File>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();
    return fileGrpcRepository.completeUpload({ id }, metadata);
  });
}

/**
 * Confirms up to a hundred direct uploads in one call, each on its own: the answer holds, in `ids`
 * order, the completed file or the error a single confirmation would have given.
 */
export async function completeFileUploads(
  ids: string[],
): Promise<ActionResult<ClientStorage.FileCompleteResult[]>> {
  return runAction(async () => {
    const metadata = await authService.getAuthMetadata();
    return (await fileGrpcRepository.completeByIds({ ids }, metadata)).items;
  });
}
