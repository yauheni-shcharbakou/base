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
} from '@backend/grpc';
import { IMAGE_SERVICE, ImageService } from 'modules/image/service/image.service';
import { Observable } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

@GrpcController()
@GrpcImageService.ControllerMethods()
export class ImageRpcController implements GrpcImageServiceController {
  constructor(@Inject(IMAGE_SERVICE) private readonly imageService: ImageService) {}

  getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcImage> {
    const stream$ = fromPromise(this.imageService.getById(request.id));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  getList(request: GrpcGetListRequest, metadata?: Metadata): Observable<GrpcImageGetListResponse> {
    return fromPromise(this.imageService.getList(request));
  }

  createOne(request: GrpcImageCreateRequest, metadata?: Metadata): Observable<GrpcImage> {
    const user = new GrpcMetadataMapper(metadata).getOrThrow('user');
    const stream$ = fromPromise(this.imageService.createOne(request, user));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  updateById(request: GrpcImageUpdateByIdRequest, metadata?: Metadata): Observable<GrpcImage> {
    const stream$ = fromPromise(this.imageService.updateById(request.id, request.update));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcImage> {
    const stream$ = fromPromise(this.imageService.deleteById(request.id));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }
}
