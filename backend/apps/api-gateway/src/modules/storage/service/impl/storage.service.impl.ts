import {
  GRPC_ACCESS_SERVICE,
  GrpcAccessService,
  GrpcFile,
  GrpcFileService,
  GrpcFileServiceClient,
  GrpcFileUploadRequest,
  GrpcStorageObjectCreate,
  GrpcStorageObjectService,
  GrpcStorageObjectServiceClient,
  GrpcStorageObjectType,
  GrpcUserRole,
} from '@backend/grpc';
import { GrpcExceptionMapper, InjectGrpcService } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { Inject, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { StorageService } from 'modules/storage/service/storage.service';
import {
  catchError,
  concatMap,
  finalize,
  map,
  Observable,
  of,
  ReplaySubject,
  switchMap,
} from 'rxjs';

@Injectable()
export class StorageServiceImpl implements StorageService {
  constructor(
    @Inject(GRPC_ACCESS_SERVICE) private readonly accessService: GrpcAccessService,
    @InjectGrpcService(GrpcFileService.name)
    private readonly fileServiceClient: GrpcFileServiceClient,
    @InjectGrpcService(GrpcStorageObjectService.name)
    private readonly storageObjectServiceClient: GrpcStorageObjectServiceClient,
  ) {}

  // uploadFile(
  //   request$: Observable<GrpcFileUploadRequest>,
  //   metadata?: Metadata,
  // ): Observable<Either<Error, GrpcFile>> {
  //   const proxy$ = new ReplaySubject<GrpcFileUploadRequest>();
  //   const requestSubscription = request$.subscribe(proxy$);
  //
  //   let storageObjectData: GrpcStorageObjectCreate;
  //
  //   const proxySubscription = proxy$.subscribe({
  //     next: (value) => {
  //       if (value.create) {
  //         storageObjectData = {
  //           ...value.create.storage,
  //           type: GrpcStorageObjectType.FILE,
  //         };
  //       }
  //     },
  //   });
  //
  //   return this.accessService.checkAccess(metadata, [GrpcUserRole.ADMIN]).pipe(
  //     map((meta) => {
  //       if (meta.isLeft()) {
  //         throw meta.value;
  //       }
  //
  //       return meta.value;
  //     }),
  //     catchError((err) => {
  //       proxy$.error(err);
  //       throw err;
  //     }),
  //     switchMap((meta) =>
  //       this.fileServiceClient
  //         .uploadOne(proxy$.asObservable(), meta)
  //         .pipe(
  //           concatMap((data) =>
  //             this.storageObjectServiceClient
  //               .createOne({ ...storageObjectData, file: data.file.id }, meta)
  //               .pipe(map(() => right(data.file))),
  //           ),
  //         ),
  //     ),
  //     catchError((exception) => of(left(GrpcExceptionMapper.toRpcException(exception)))),
  //     finalize(() => {
  //       proxySubscription.unsubscribe();
  //       requestSubscription.unsubscribe();
  //     }),
  //   );
  // }
}
