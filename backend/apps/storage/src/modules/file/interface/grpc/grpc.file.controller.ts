import { GrpcController, GrpcRxPipe } from '@backend/grpc';
import {
  GrpcFileServiceController,
  GrpcFileTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { FileCreateManyUseCase } from '@modules/file/application/use-cases/file.create-many.use-case';
import { FileCreateOneUseCase } from '@modules/file/application/use-cases/file.create-one.use-case';
import { FileDeleteUseCase } from '@modules/file/application/use-cases/file.delete.use-case';
import { FileGetDownloadMapUseCase } from '@modules/file/application/use-cases/file.get-download-map.use-case';
import { FileGetUrlMapUseCase } from '@modules/file/application/use-cases/file.get-url-map.use-case';
import { FileGetUseCase } from '@modules/file/application/use-cases/file.get.use-case';
import { FileUploadOneUseCase } from '@modules/file/application/use-cases/file.upload-one.use-case';
import { from, Observable } from 'rxjs';

@GrpcController()
@GrpcFileTransport.ControllerMethods()
export class GrpcFileController implements GrpcFileServiceController {
  constructor(
    private readonly getUrlMapUseCase: FileGetUrlMapUseCase,
    private readonly getDownloadMapUseCase: FileGetDownloadMapUseCase,
    private readonly getUseCase: FileGetUseCase,
    private readonly greateOneUseCase: FileCreateOneUseCase,
    private readonly createManyUseCase: FileCreateManyUseCase,
    private readonly uploadOneUseCase: FileUploadOneUseCase,
    private readonly deleteUseCase: FileDeleteUseCase,
  ) {}

  getUrlMap({ ip, ...query }: NestStorage.GetUrlMap): Observable<NestCommon.StringMap> {
    return from(this.getUrlMapUseCase.execute(query, ip)).pipe(GrpcRxPipe.toMapEntries);
  }

  getDownloadMap({ ip, ...query }: NestStorage.GetUrlMap): Observable<NestStorage.DownloadMap> {
    return from(this.getDownloadMapUseCase.execute(query, ip)).pipe(GrpcRxPipe.toMapEntries);
  }

  getById(request: NestCommon.IdField): Observable<NestStorage.File> {
    return from(this.getUseCase.getOne({ id: request.id })).pipe(GrpcRxPipe.unwrapEither);
  }

  getList(request: NestCommon.GetList): Observable<NestStorage.FileList> {
    return from(this.getUseCase.getList(request));
  }

  createOne(request: NestStorage.FileCreateOne): Observable<NestStorage.File> {
    return from(this.greateOneUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  createMany(request: NestStorage.FileCreateMany): Observable<NestStorage.FileArray> {
    const stream$ = from(this.createManyUseCase.execute(request));
    return stream$.pipe(GrpcRxPipe.unwrapEither, GrpcRxPipe.toArrayItems);
  }

  uploadOne(
    request: Observable<NestStorage.UploadOne>,
  ): Observable<NestStorage.FileUploadResponse> {
    return this.uploadOneUseCase.execute(request).pipe(GrpcRxPipe.unwrapEither);
  }

  deleteOne(request: NestStorage.FileQuery): Observable<NestStorage.File> {
    return from(this.deleteUseCase.deleteOne(request)).pipe(GrpcRxPipe.unwrapEither);
  }
}
