import { GrpcController, GrpcRxPipe } from '@backend/grpc';
import {
  GrpcVideoServiceController,
  GrpcVideoTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { VideoCreateManyUseCase } from '@modules/video/application/use-cases/video.create-many.use-case';
import { VideoCreateOneUseCase } from '@modules/video/application/use-cases/video.create-one.use-case';
import { VideoDeleteOneUseCase } from '@modules/video/application/use-cases/video.delete-one.use-case';
import { VideoGetDownloadMapUseCase } from '@modules/video/application/use-cases/video.get-download-map.use-case';
import { VideoGetUrlMapUseCase } from '@modules/video/application/use-cases/video.get-url-map.use-case';
import { VideoGetUseCase } from '@modules/video/application/use-cases/video.get.use-case';
import { VideoUpdateUseCase } from '@modules/video/application/use-cases/video.update.use-case';
import { from, Observable } from 'rxjs';

@GrpcController()
@GrpcVideoTransport.ControllerMethods()
export class GrpcVideoController implements GrpcVideoServiceController {
  constructor(
    private readonly getUseCase: VideoGetUseCase,
    private readonly getUrlMapUseCase: VideoGetUrlMapUseCase,
    private readonly getDownloadMapUseCase: VideoGetDownloadMapUseCase,
    private readonly deleteOneUseCase: VideoDeleteOneUseCase,
    private readonly updateUseCase: VideoUpdateUseCase,
    private readonly createOneUseCase: VideoCreateOneUseCase,
    private readonly createManyUseCase: VideoCreateManyUseCase,
  ) {}

  getUrlMap(request: NestStorage.GetUrlMap): Observable<NestCommon.StringMap> {
    return from(this.getUrlMapUseCase.execute(request)).pipe(GrpcRxPipe.toMapEntries);
  }

  getDownloadMap(request: NestStorage.GetUrlMap): Observable<NestStorage.DownloadMap> {
    return from(this.getDownloadMapUseCase.execute(request)).pipe(GrpcRxPipe.toMapEntries);
  }

  getOne(request: NestStorage.VideoQuery): Observable<NestStorage.VideoPopulated> {
    const stream$ = from(
      this.getUseCase.getOne<NestStorage.VideoPopulated>(request, { populate: ['file'] }),
    );

    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  getList(request: NestCommon.GetList): Observable<NestStorage.VideoList> {
    return from(
      this.getUseCase.getList<NestStorage.VideoPopulated>(request, { populate: ['file'] }),
    );
  }

  createOne(request: NestStorage.VideoCreateOne): Observable<NestStorage.VideoCreated> {
    return from(this.createOneUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  createMany(request: NestStorage.VideoCreateMany): Observable<NestStorage.VideoCreatedArray> {
    const stream$ = from(this.createManyUseCase.execute(request));
    return stream$.pipe(GrpcRxPipe.unwrapEither, GrpcRxPipe.toArrayItems);
  }

  updateOne(request: NestStorage.VideoUpdateOne): Observable<NestStorage.Video> {
    const stream$ = from(this.updateUseCase.updateOne(request.query, request.update));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  deleteOne(request: NestStorage.VideoQuery): Observable<NestStorage.Video> {
    return from(this.deleteOneUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }
}
