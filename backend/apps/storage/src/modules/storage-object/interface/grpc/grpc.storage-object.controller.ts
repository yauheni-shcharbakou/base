import { GrpcController, GrpcRxPipe } from '@backend/grpc';
import {
  GrpcStorageObjectServiceController,
  GrpcStorageObjectTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { StorageObjectCreateOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.create-one.use-case';
import { StorageObjectDeleteOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.delete-one.use-case';
import { StorageObjectGetFoldersUseCase } from '@modules/storage-object/application/use-cases/storage-object.get-folders.use-case';
import { StorageObjectGetUseCase } from '@modules/storage-object/application/use-cases/storage-object.get.use-case';
import { StorageObjectIsExistsUseCase } from '@modules/storage-object/application/use-cases/storage-object.is-exists.use-case';
import { StorageObjectUpdateOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.update-one.use-case';
import { from, map, Observable } from 'rxjs';

@GrpcController()
@GrpcStorageObjectTransport.ControllerMethods()
export class GrpcStorageObjectController implements GrpcStorageObjectServiceController {
  constructor(
    private readonly getUseCase: StorageObjectGetUseCase,
    private readonly getFoldersUseCase: StorageObjectGetFoldersUseCase,
    private readonly isExistsUseCase: StorageObjectIsExistsUseCase,
    private readonly deleteOneUseCase: StorageObjectDeleteOneUseCase,
    private readonly updateOneUseCase: StorageObjectUpdateOneUseCase,
    private readonly createOneUseCase: StorageObjectCreateOneUseCase,
  ) {}

  getById(request: NestCommon.IdField): Observable<NestStorage.StorageObjectPopulated> {
    const stream$ = from(
      this.getUseCase.getOne<NestStorage.StorageObjectPopulated>(
        { id: request.id, isDeleted: false },
        {
          populate: ['file', 'image', 'video'],
        },
      ),
    );

    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  getMany(request: NestStorage.StorageObjectQuery): Observable<NestStorage.StorageObjectArray> {
    const stream$ = from(
      this.getUseCase.getMany<NestStorage.StorageObjectPopulated>(
        { ...request, isDeleted: false },
        { populate: ['file', 'image', 'video'] },
      ),
    );

    return stream$.pipe(GrpcRxPipe.toArrayItems);
  }

  getList(request: NestCommon.GetList): Observable<NestStorage.StorageObjectList> {
    return from(
      this.getUseCase.getList<NestStorage.StorageObjectPopulated>(
        { ...request, query: { isDeleted: false } },
        { populate: ['file', 'image', 'video'] },
      ),
    );
  }

  getFolders(
    request: NestStorage.StorageObjectGetFolders,
  ): Observable<NestStorage.StorageObjectArray> {
    const stream$ = from(this.getFoldersUseCase.execute(request));
    return stream$.pipe(GrpcRxPipe.toArrayItems);
  }

  isExists(request: NestStorage.StorageObjectQuery): Observable<NestCommon.Boolean> {
    const stream$ = from(this.isExistsUseCase.isExists({ ...request, isDeleted: false }));
    return stream$.pipe(map((result) => ({ value: result })));
  }

  createOne(request: NestStorage.StorageObjectCreate): Observable<NestStorage.StorageObject> {
    return from(this.createOneUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  updateOne(request: NestStorage.StorageObjectUpdateOne): Observable<NestStorage.StorageObject> {
    const stream$ = from(this.updateOneUseCase.execute(request.query, request.update));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  deleteOne(request: NestStorage.StorageObjectQuery): Observable<NestStorage.StorageObject> {
    return from(this.deleteOneUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }
}
