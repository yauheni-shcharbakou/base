import { ValidateGrpcPayload } from '@backend/grpc';
import {
  GrpcTempCodeAdminServiceController,
  GrpcTempCodeAdminTransport,
  NestAuth,
  NestCommon,
} from '@backend/proto';
import { GetListDto } from '@common/application/dto/get-list.dto';
import { IdFieldDto } from '@common/application/dto/id-field.dto';
import { QueryDto } from '@common/application/dto/query.dto';
import { AdminGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { TempCodeCreateDto } from '../../application/dto/temp-code.create.dto';
import { TempCodeProxyService } from '../../application/services/temp-code.proxy.service';

@AdminGrpcController()
@GrpcTempCodeAdminTransport.ControllerMethods()
export class GrpcTempCodeAdminController implements GrpcTempCodeAdminServiceController {
  constructor(private readonly tempCodeService: TempCodeProxyService) {}

  @ValidateGrpcPayload(IdFieldDto)
  getById({ id }: NestCommon.IdField): Promise<NestAuth.TempCode> {
    return this.tempCodeService.getById(id);
  }

  @ValidateGrpcPayload(GetListDto)
  getList(request: NestCommon.GetList): Promise<NestAuth.TempCodeList> {
    return this.tempCodeService.getList(request);
  }

  @ValidateGrpcPayload(TempCodeCreateDto)
  createOne(request: NestAuth.TempCodeCreate): Promise<NestAuth.TempCode> {
    return this.tempCodeService.createOne(request);
  }

  @ValidateGrpcPayload(QueryDto)
  deactivateOne(request: NestCommon.Query): Promise<NestAuth.TempCode> {
    return this.tempCodeService.deactivateOne(request);
  }

  @ValidateGrpcPayload(IdFieldDto)
  deleteById({ id }: NestCommon.IdField): Promise<NestAuth.TempCode> {
    return this.tempCodeService.deleteById(id);
  }
}
