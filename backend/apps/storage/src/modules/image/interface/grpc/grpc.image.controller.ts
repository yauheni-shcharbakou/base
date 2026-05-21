import { GrpcController, GrpcRxPipe } from '@backend/grpc';
import {
  GrpcImageServiceController,
  GrpcImageTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { ImageCreateManyUseCase } from '@modules/image/application/use-cases/image.create-many.use-case';
import { ImageCreateOneUseCase } from '@modules/image/application/use-cases/image.create-one.use-case';
import { ImageDeleteOneUseCase } from '@modules/image/application/use-cases/image.delete-one.use-case';
import { ImageGetUseCase } from '@modules/image/application/use-cases/image.get.use-case';
import { ImageUpdateUseCase } from '@modules/image/application/use-cases/image.update.use-case';
import { from, map, Observable } from 'rxjs';

@GrpcController()
@GrpcImageTransport.ControllerMethods()
export class GrpcImageController implements GrpcImageServiceController {
  constructor(
    private readonly getUseCase: ImageGetUseCase,
    private readonly deleteOneUseCase: ImageDeleteOneUseCase,
    private readonly createOneUseCase: ImageCreateOneUseCase,
    private readonly createManyUseCase: ImageCreateManyUseCase,
    private readonly updateUseCase: ImageUpdateUseCase,
  ) {}

  getById(request: NestCommon.IdField): Observable<NestStorage.ImagePopulated> {
    const stream$ = from(
      this.getUseCase.getById<NestStorage.ImagePopulated>(request.id, { populate: ['file'] }),
    );

    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  getList(request: NestCommon.GetList): Observable<NestStorage.ImageList> {
    return from(
      this.getUseCase.getList<NestStorage.ImagePopulated>(request, { populate: ['file'] }),
    );
  }

  createOne(request: NestStorage.ImageCreateOne): Observable<NestStorage.Image> {
    return from(this.createOneUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  createMany(request: NestStorage.ImageCreateMany): Observable<NestStorage.ImageArray> {
    const stream$ = from(this.createManyUseCase.execute(request));

    return stream$.pipe(
      GrpcRxPipe.unwrapEither,
      map((images) => ({ images })),
    );
  }

  updateOne(request: NestStorage.ImageUpdateOne): Observable<NestStorage.Image> {
    const stream$ = from(this.updateUseCase.updateOne(request.query, request.update));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  deleteOne(request: NestStorage.ImageQuery): Observable<NestStorage.Image> {
    return from(this.deleteOneUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }
}
