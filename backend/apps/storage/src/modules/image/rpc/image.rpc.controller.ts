import { GrpcController, GrpcMetadataMapper, GrpcRxPipe } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { Inject } from '@nestjs/common';
import {
  GrpcGetListRequest,
  GrpcIdField,
  GrpcImage,
  GrpcImageGetListResponse,
  GrpcImageService,
  GrpcImageServiceController,
  GrpcImageUpdateByIdRequest,
  GrpcImageCreateRequest,
  GrpcImagePopulated,
  GrpcImageCreateManyRequest,
  GrpcImageCreateManyResponse,
} from '@backend/grpc';
import { IMAGE_SERVICE, ImageService } from 'modules/image/service/image.service';
import { from, Observable } from 'rxjs';

@GrpcController()
@GrpcImageService.ControllerMethods()
export class ImageRpcController implements GrpcImageServiceController {
  constructor(@Inject(IMAGE_SERVICE) private readonly imageService: ImageService) {}

  getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcImagePopulated> {
    const stream$ = from(
      this.imageService.getById<GrpcImagePopulated>(request.id, { populate: ['file'] }),
    );

    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  getList(request: GrpcGetListRequest, metadata?: Metadata): Observable<GrpcImageGetListResponse> {
    return from(this.imageService.getList<GrpcImagePopulated>(request, { populate: ['file'] }));
  }

  createOne(request: GrpcImageCreateRequest, metadata?: Metadata): Observable<GrpcImage> {
    const user = new GrpcMetadataMapper(metadata).getOrThrow('user');
    const stream$ = from(this.imageService.createOne(request, user));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  createMany(
    request: GrpcImageCreateManyRequest,
    metadata?: Metadata,
  ): Observable<GrpcImageCreateManyResponse> {
    const user = new GrpcMetadataMapper(metadata).getOrThrow('user');
    const stream$ = from(this.imageService.createMany(request, user));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  updateById(request: GrpcImageUpdateByIdRequest, metadata?: Metadata): Observable<GrpcImage> {
    const stream$ = from(this.imageService.updateById(request.id, request.update));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcImage> {
    const stream$ = from(this.imageService.deleteById(request.id));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }
}
