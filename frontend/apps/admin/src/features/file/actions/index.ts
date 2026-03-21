'use server';

import { getErrorMessage } from '@/common/helpers';
import { authService } from '@/features/auth/services';
import {
  fileGrpcRepository,
  imageGrpcRepository,
  storageObjectGrpcRepository,
  videoGrpcRepository,
} from '@/features/grpc/repositories';
import {
  GrpcStorageObjectPopulated,
  GrpcStorageObjectType,
  GrpcFile,
  GrpcVideoCreateRequest,
  GrpcVideo,
  GrpcImageCreateRequest,
  GrpcFileCreate,
  GrpcImage,
  GrpcStorageObjectCreate,
  GrpcStorageObject,
} from '@frontend/grpc';

type CreateActionResponse<T> = { entity: T } | { error: string };

export async function getUserFolders(userId: string): Promise<GrpcStorageObjectPopulated[]> {
  try {
    const metadata = await authService.getAuthMetadata();

    const list = await storageObjectGrpcRepository.getMany(
      { query: { userId, type: GrpcStorageObjectType.FOLDER, ids: [] } },
      metadata,
    );

    return list.items;
  } catch (error) {
    return [];
  }
}

export async function createFile(request: GrpcFileCreate): Promise<CreateActionResponse<GrpcFile>> {
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

export async function createStorageObject(
  request: GrpcStorageObjectCreate,
): Promise<CreateActionResponse<GrpcStorageObject>> {
  try {
    const metadata = await authService.getAuthMetadata();
    const entity = await storageObjectGrpcRepository.createOne(request, metadata);
    return { entity };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}
