import { GrpcController, GrpcRxPipe } from '@backend/grpc';
import {
  GrpcStorageObjectServiceController,
  GrpcStorageObjectTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { StorageObjectCreateFoldersUseCase } from '@modules/storage-object/application/use-cases/storage-object.create-folders.use-case';
import { StorageObjectCreateOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.create-one.use-case';
import { StorageObjectDeleteManyUseCase } from '@modules/storage-object/application/use-cases/storage-object.delete-many.use-case';
import { StorageObjectDeleteOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.delete-one.use-case';
import { StorageObjectGetFolderContentUseCase } from '@modules/storage-object/application/use-cases/storage-object.get-folder-content.use-case';
import { StorageObjectGetFoldersUseCase } from '@modules/storage-object/application/use-cases/storage-object.get-folders.use-case';
import { StorageObjectGetUseCase } from '@modules/storage-object/application/use-cases/storage-object.get.use-case';
import { StorageObjectIsExistsUseCase } from '@modules/storage-object/application/use-cases/storage-object.is-exists.use-case';
import { StorageObjectMoveManyUseCase } from '@modules/storage-object/application/use-cases/storage-object.move-many.use-case';
import { StorageObjectUpdateOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.update-one.use-case';
import { StorageObjectUpdatePublicManyUseCase } from '@modules/storage-object/application/use-cases/storage-object.update-public-many.use-case';
import { Either } from '@sweet-monads/either';
import _ from 'lodash';
import { from, map, Observable } from 'rxjs';

// `folderPath` is a lazy formula: listed here, it rides in the same SELECT as the rows and the
// to-one media joins — one statement per call however many rows, never a query per row.
const POPULATE: (keyof NestStorage.StorageObjectPopulated)[] = [
  'file',
  'image',
  'video',
  'folderPath',
];

// And a folder's `folderStats`, a walk of its whole subtree: only for the reads that show it — a
// single object and the admin's list — not for `getMany`, nor the rows a write reads back.
const POPULATE_WITH_STATS: (keyof NestStorage.StorageObjectPopulated)[] = [
  ...POPULATE,
  'folderStats',
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
    private readonly createFoldersUseCase: StorageObjectCreateFoldersUseCase,
    private readonly updatePublicManyUseCase: StorageObjectUpdatePublicManyUseCase,
  ) {}

  getById(request: NestCommon.IdField): Observable<NestStorage.StorageObjectPopulated> {
    const stream$ = from(
      this.getUseCase.getOne<NestStorage.StorageObjectPopulated>(
        { id: request.id, isDeleted: false },
        { populate: POPULATE_WITH_STATS },
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
        { populate: POPULATE_WITH_STATS },
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

  createFolders(
    request: NestStorage.StorageObjectCreateFolders,
  ): Observable<NestStorage.StorageObjectArray> {
    const stream$ = from(this.populate(this.createFoldersUseCase.execute(request), false));
    return stream$.pipe(GrpcRxPipe.unwrapEither, GrpcRxPipe.toArrayItems);
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
    const stream$ = from(this.populate(this.deleteManyUseCase.execute(request), true));
    return stream$.pipe(GrpcRxPipe.unwrapEither, GrpcRxPipe.toArrayItems);
  }

  moveMany(request: NestStorage.StorageObjectMoveMany): Observable<NestStorage.StorageObjectArray> {
    const stream$ = from(this.populate(this.moveManyUseCase.execute(request), false));
    return stream$.pipe(GrpcRxPipe.unwrapEither, GrpcRxPipe.toArrayItems);
  }

  updatePublicMany(
    request: NestStorage.StorageObjectUpdatePublicMany,
  ): Observable<NestStorage.StorageObjectArray> {
    const stream$ = from(this.populate(this.updatePublicManyUseCase.execute(request), false));
    return stream$.pipe(GrpcRxPipe.unwrapEither, GrpcRxPipe.toArrayItems);
  }

  /**
   * A batch write's rows, read back with their media, in the order written. `StorageObjectArray`
   * carries `StorageObjectPopulated`, and a written row holds its file, image or video as a bare
   * reference, which the serializer refuses (`file: object expected`) — a folder has none, so only
   * a batch with media ever failed.
   */
  private async populate(
    written: Promise<Either<Error, NestStorage.StorageObject[]>>,
    isDeleted: boolean,
  ): Promise<Either<Error, NestStorage.StorageObjectPopulated[]>> {
    return (await written).asyncMap(async (rows) => {
      const read = await this.getUseCase.getMany<NestStorage.StorageObjectPopulated>(
        { ids: rows.map(({ id }) => id), isDeleted },
        { populate: POPULATE },
      );
      const byId = _.keyBy(read, 'id');

      return rows.map(({ id }) => byId[id]);
    });
  }
}
