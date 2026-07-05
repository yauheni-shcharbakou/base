import { GrpcController, GrpcRxPipe } from '@backend/grpc';
import {
  GrpcTempCodeServiceController,
  GrpcTempCodeTransport,
  NestAuth,
  NestCommon,
} from '@backend/proto';
import { TempCodeCreateOneUseCase } from '@modules/temp-code/application/use-cases/temp-code.create-one.use-case';
import { TempCodeDeactivateOneUseCase } from '@modules/temp-code/application/use-cases/temp-code.deactivate-one.use-case';
import { TempCodeDeleteUseCase } from '@modules/temp-code/application/use-cases/temp-code.delete.use-case';
import { TempCodeGetUseCase } from '@modules/temp-code/application/use-cases/temp-code.get.use-case';
import { from, Observable } from 'rxjs';

@GrpcController()
@GrpcTempCodeTransport.ControllerMethods()
export class GrpcTempCodeController implements GrpcTempCodeServiceController {
  constructor(
    private readonly getUseCase: TempCodeGetUseCase,
    private readonly deleteUseCase: TempCodeDeleteUseCase,
    private readonly deactivateOneUseCase: TempCodeDeactivateOneUseCase,
    private readonly createOneUseCase: TempCodeCreateOneUseCase,
  ) {}

  getById(request: NestCommon.IdField): Observable<NestAuth.TempCode> {
    return from(this.getUseCase.getById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }

  getList(request: NestCommon.GetList): Observable<NestAuth.TempCodeList> {
    return from(this.getUseCase.getList(request));
  }

  createOne(request: NestAuth.TempCodeCreate): Observable<NestAuth.TempCode> {
    return from(this.createOneUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  deactivateOne(request: NestCommon.Query): Observable<NestAuth.TempCode> {
    return from(this.deactivateOneUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  deleteById(request: NestCommon.IdField): Observable<NestAuth.TempCode> {
    return from(this.deleteUseCase.deleteById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }
}
