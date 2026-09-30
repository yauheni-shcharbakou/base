import { GrpcController, GrpcRxPipe } from '@backend/grpc';
import {
  GrpcStorageObjectServiceController,
  GrpcStorageObjectTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { StorageObjectCreateOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.create-one.use-case';
import { StorageObjectDeleteManyUseCase } from '@modules/storage-object/application/use-cases/storage-object.delete-many.use-case';
import { StorageObjectDeleteOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.delete-one.use-case';
import { StorageObjectGetFolderContentUseCase } from '@modules/storage-object/application/use-cases/storage-object.get-folder-content.use-case';
import { StorageObjectGetFoldersUseCase } from '@modules/storage-object/application/use-cases/storage-object.get-folders.use-case';
import { StorageObjectGetUseCase } from '@modules/storage-object/application/use-cases/storage-object.get.use-case';
import { StorageObjectIsExistsUseCase } from '@modules/storage-object/application/use-cases/storage-object.is-exists.use-case';
import { StorageObjectMoveManyUseCase } from '@modules/storage-object/application/use-cases/storage-object.move-many.use-case';
import { StorageObjectUpdateOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.update-one.use-case';
import { from, map, Observable } from 'rxjs';

// `folderPath` is a lazy formula: listed here, it rides in the same SELECT as the rows and the
// to-one media joins — one statement per call however many rows, never a query per row.
const POPULATE: (keyof NestStorage.StorageObjectPopulated)[] = [
  'file',
  'image',
  'video',
  'folderPath',
];

@GrpcController()
@GrpcStorageObjectTransport.ControllerMethods()
export class GrpcStorageObjectController implements GrpcStorageObjectServiceController {
  constructor(
    private readonly getUseCase: StorageObjectGetUseCase,
    private readonly getFoldersUseCase: StorageObjectGetFoldersUseCase,
    private readonly getFolderContentUseCase: StorageObjectGetFolderContentUseCase,
    private readonly isExistsUseCase: StorageObjectIsExistsUseCase,
    private readonly deleteOneUseCase: StorageObjectDeleteOneUseCase,
    private readonly updateOneUseCase: StorageObjectUpdateOneUseCase,
    private readonly createOneUseCase: StorageObjectCreateOneUseCase,
    private readonly deleteManyUseCase: StorageObjectDeleteManyUseCase,
    private readonly moveManyUseCase: StorageObjectMoveManyUseCase,
  ) {}

  getById(request: NestCommon.IdField): Observable<NestStorage.StorageObjectPopulated> {
    const stream$ = from(
      this.getUseCase.getOne<NestStorage.StorageObjectPopulated>(
        { id: request.id, isDeleted: false },
        { populate: POPULATE },
      ),
    );

    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  getMany(request: NestStorage.StorageObjectQuery): Observable<NestStorage.StorageObjectArray> {
    const stream$ = from(
      this.getUseCase.getMany<NestStorage.StorageObjectPopulated>(
        { ...request, isDeleted: false },
        { populate: POPULATE },
      ),
    );

    return stream$.pipe(GrpcRxPipe.toArrayItems);
  }

  getList(request: NestCommon.GetList): Observable<NestStorage.StorageObjectList> {
    return from(
      this.getUseCase.getList<NestStorage.StorageObjectPopulated>(
        { ...request, query: { isDeleted: false } },
        { populate: POPULATE },
      ),
    );
  }

  getFolders(
    request: NestStorage.StorageObjectGetFolders,
  ): Observable<NestStorage.StorageObjectArray> {
    const stream$ = from(this.getFoldersUseCase.execute(request));
    return stream$.pipe(GrpcRxPipe.unwrapEither, GrpcRxPipe.toArrayItems);
  }

  getFolderContent(
    request: NestStorage.StorageObjectGetFolderContent,
  ): Observable<NestStorage.StorageObjectFolderContent> {
    return from(this.getFolderContentUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  // The user's one live folder without a parent. There is none yet while `auth.user.create` waits
  // to be handled, and none any more once the user's deletion has marked the tree: `NotFound`.
  getRootFolder({ userId }: NestCommon.UserIdField): Observable<NestStorage.StorageObject> {
    const stream$ = from(
      this.getUseCase.getOne({ userId, isFolder: true, isRoot: true, isDeleted: false }),
    );

    return stream$.pipe(GrpcRxPipe.unwrapEither);
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

  deleteMany(
    request: NestStorage.StorageObjectDeleteMany,
  ): Observable<NestStorage.StorageObjectArray> {
    const stream$ = from(this.deleteManyUseCase.execute(request));
    return stream$.pipe(GrpcRxPipe.unwrapEither, GrpcRxPipe.toArrayItems);
  }

  moveMany(request: NestStorage.StorageObjectMoveMany): Observable<NestStorage.StorageObjectArray> {
    const stream$ = from(this.moveManyUseCase.execute(request));
    return stream$.pipe(GrpcRxPipe.unwrapEither, GrpcRxPipe.toArrayItems);
  }
}
