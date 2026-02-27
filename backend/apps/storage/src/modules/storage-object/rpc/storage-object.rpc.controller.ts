import { GrpcController, GrpcMetadataMapper, GrpcRxPipe } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { Inject } from '@nestjs/common';
import {
  GrpcGetListRequest,
  GrpcIdField,
  GrpcStorageObject,
  GrpcStorageObjectCreate,
  GrpcStorageObjectGetListResponse,
  GrpcStorageObjectList,
  GrpcStorageObjectRequest,
  GrpcStorageObjectService,
  GrpcStorageObjectServiceController,
  GrpcStorageObjectUpdateByIdRequest,
} from '@backend/grpc';
import {
  STORAGE_OBJECT_SERVICE,
  StorageObjectService,
} from 'modules/storage-object/service/storage-object.service';
import { map, Observable } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

@GrpcController()
@GrpcStorageObjectService.ControllerMethods()
export class StorageObjectRpcController implements GrpcStorageObjectServiceController {
  constructor(
    @Inject(STORAGE_OBJECT_SERVICE)
    private readonly storageObjectService: StorageObjectService,
  ) {}

  getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcStorageObject> {
    const stream$ = fromPromise(this.storageObjectService.getById(request.id));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  getMany(
    request: GrpcStorageObjectRequest,
    metadata?: Metadata,
  ): Promise<GrpcStorageObjectList> | Observable<GrpcStorageObjectList> | GrpcStorageObjectList {
    const stream$ = fromPromise(this.storageObjectService.getMany(request.query));
    return stream$.pipe(map((items) => ({ items })));
  }

  getList(
    request: GrpcGetListRequest,
    metadata?: Metadata,
  ): Observable<GrpcStorageObjectGetListResponse> {
    return fromPromise(this.storageObjectService.getList(request, ['file', 'image', 'video']));
  }

  createOne(request: GrpcStorageObjectCreate, metadata?: Metadata): Observable<GrpcStorageObject> {
    const user = new GrpcMetadataMapper(metadata).getOrThrow('user');
    const stream$ = fromPromise(this.storageObjectService.saveOne({ ...request, user }));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  updateById(
    request: GrpcStorageObjectUpdateByIdRequest,
    metadata?: Metadata,
  ): Observable<GrpcStorageObject> {
    const stream$ = fromPromise(this.storageObjectService.updateById(request.id, request.update));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcStorageObject> {
    const stream$ = fromPromise(this.storageObjectService.deleteById(request.id));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }
}
