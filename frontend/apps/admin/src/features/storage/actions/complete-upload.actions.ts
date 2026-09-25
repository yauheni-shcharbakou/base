'use server';

import { getErrorMessage } from '@/common/helpers';
import { authService } from '@/features/auth/services';
import { fileGrpcRepository } from '@/features/grpc/repositories';
import type { ClientStorage } from '@frontend/proto';

type CompleteActionResponse = { entity: ClientStorage.File } | { error: string };

/** Confirms a direct upload: the backend checks the stored size and turns the file READY. */
export async function completeFileUpload(id: string): Promise<CompleteActionResponse> {
  try {
    const metadata = await authService.getAuthMetadata();
    const entity = await fileGrpcRepository.completeUpload({ id }, metadata);
    return { entity };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}
