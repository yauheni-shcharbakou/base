import { GrpcController, GrpcRxPipe } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { Inject } from '@nestjs/common';
import {
  GrpcGetListRequest,
  GrpcIdField,
  GrpcTempCode,
  GrpcTempCodeCreate,
  GrpcTempCodeGetListResponse,
  GrpcTempCodeService,
  GrpcTempCodeServiceController,
} from '@backend/grpc';
import { TEMP_CODE_SERVICE, TempCodeService } from 'modules/temp-code/service/temp-code.service';
import { from, Observable } from 'rxjs';

@GrpcController()
@GrpcTempCodeService.ControllerMethods()
export class TempCodeRpcController implements GrpcTempCodeServiceController {
  constructor(@Inject(TEMP_CODE_SERVICE) private readonly tempCodeService: TempCodeService) {}

  getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcTempCode> {
    return from(this.tempCodeService.getById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }

  getList(
    request: GrpcGetListRequest,
    metadata?: Metadata,
  ): Observable<GrpcTempCodeGetListResponse> {
    return from(this.tempCodeService.getList(request));
  }

  createOne(request: GrpcTempCodeCreate, metadata?: Metadata): Observable<GrpcTempCode> {
    return from(this.tempCodeService.saveOne(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcTempCode> {
    return from(this.tempCodeService.deleteById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }
}
