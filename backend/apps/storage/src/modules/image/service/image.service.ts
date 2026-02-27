import { GrpcImage, GrpcImageCreateRequest, GrpcImageQuery } from '@backend/grpc';
import { CrudService } from '@backend/persistence';
import { Either } from '@sweet-monads/either';

export const IMAGE_SERVICE = Symbol('ImageService');

export interface ImageService extends CrudService<GrpcImage, GrpcImageQuery> {
  createOne(request: GrpcImageCreateRequest, user: string): Promise<Either<Error, GrpcImage>>;
  onFileDelete(file: string): Promise<void>;
}
