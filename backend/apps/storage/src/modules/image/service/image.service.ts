import {
  GrpcImage,
  GrpcImageCreate,
  GrpcImageCreateManyRequest,
  GrpcImageCreateManyResponse,
  GrpcImageCreateRequest,
  GrpcImageQuery,
  GrpcImageUpdate,
} from '@backend/grpc';
import { CrudService } from '@backend/persistence';
import { Either } from '@sweet-monads/either';

export const IMAGE_SERVICE = Symbol('ImageService');

export interface ImageService extends CrudService<
  GrpcImage,
  GrpcImageQuery,
  GrpcImageCreate,
  GrpcImageUpdate
> {
  createOne(request: GrpcImageCreateRequest, userId: string): Promise<Either<Error, GrpcImage>>;
  createMany(
    request: GrpcImageCreateManyRequest,
    userId: string,
  ): Promise<Either<Error, GrpcImageCreateManyResponse>>;
}
