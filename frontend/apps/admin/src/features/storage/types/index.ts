import { GrpcStorageObjectCreate } from '@packages/grpc';

export type StorageData = Partial<Pick<GrpcStorageObjectCreate, 'parent' | 'isPublic' | 'name'>>;
