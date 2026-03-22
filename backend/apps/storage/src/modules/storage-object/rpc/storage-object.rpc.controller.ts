import { GrpcController, GrpcMetadataMapper, GrpcRxPipe } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { Inject } from '@nestjs/common';
import {
  GrpcBooleanResult,
  GrpcGetListRequest,
  GrpcIdField,
  GrpcStorageObject,
  GrpcStorageObjectCreate,
  GrpcStorageObjectGetListResponse,
  GrpcStorageObjectList,
  GrpcStorageObjectPopulated,
  GrpcStorageObjectRequest,
  GrpcStorageObjectService,
  GrpcStorageObjectServiceController,
  GrpcStorageObjectUpdateByIdRequest,
  GrpcStorageObjectExistsFolderRequest,
} from '@backend/grpc';
import {
  STORAGE_OBJECT_SERVICE,
  StorageObjectService,
} from 'modules/storage-object/service/storage-object.service';
import { from, map, Observable } from 'rxjs';

@GrpcController()
@GrpcStorageObjectService.ControllerMethods()
export class StorageObjectRpcController implements GrpcStorageObjectServiceController {
  constructor(
    @Inject(STORAGE_OBJECT_SERVICE)
    private readonly storageObjectService: StorageObjectService,
  ) {}

  isExistsFolder(
    request: GrpcStorageObjectExistsFolderRequest,
    metadata?: Metadata,
  ): Observable<GrpcBooleanResult> {
    const userId = new GrpcMetadataMapper(metadata).getOrThrow('user');
    return from(this.storageObjectService.isExistsFolder(request, userId));
  }

  getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcStorageObjectPopulated> {
    const stream$ = from(
      this.storageObjectService.getById<GrpcStorageObjectPopulated>(request.id, {
        populate: ['video', 'image', 'file'],
      }),
    );

    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  getMany(
    request: GrpcStorageObjectRequest,
    metadata?: Metadata,
  ): Observable<GrpcStorageObjectList> {
    const stream$ = from(
      this.storageObjectService.getMany<GrpcStorageObjectPopulated>(request.query, {
        populate: ['video', 'image', 'file'],
      }),
    );

    return stream$.pipe(map((items) => ({ items })));
  }

  getList(
    request: GrpcGetListRequest,
    metadata?: Metadata,
  ): Observable<GrpcStorageObjectGetListResponse> {
    return from(
      this.storageObjectService.getList<GrpcStorageObjectPopulated>(request, {
        populate: ['file', 'image', 'video'],
      }),
    );
  }

  createOne(request: GrpcStorageObjectCreate, metadata?: Metadata): Observable<GrpcStorageObject> {
    const userId = new GrpcMetadataMapper(metadata).getOrThrow('user');
    const stream$ = from(this.storageObjectService.createOne(request, userId));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  updateById(
    request: GrpcStorageObjectUpdateByIdRequest,
    metadata?: Metadata,
  ): Observable<GrpcStorageObject> {
    const stream$ = from(this.storageObjectService.updateById(request.id, request.update));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcStorageObject> {
    const stream$ = from(this.storageObjectService.deleteById(request.id));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }
}
