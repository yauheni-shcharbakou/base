import { ValidateGrpcPayload } from '@backend/grpc';
import {
  GrpcFileAdminServiceController,
  GrpcFileAdminTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { GetListDto } from '@common/application/dto/get-list.dto';
import { IdFieldDto } from '@common/application/dto/id-field.dto';
import { GetUrlMapShortDto } from '@common/application/dto/storage/get-url-map.dto';
import { AdminGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { GrpcStreamMethod } from '@common/interface/grpc/decorators/grpc.stream-method.decorator';
import { FileCreateManyDto } from '@modules/file/application/dto/file.create-many.dto';
import { FileCreateOneDto } from '@modules/file/application/dto/file.create.dto';
import { FileProxyService } from '@modules/file/application/services/file.proxy.service';
import { Observable } from 'rxjs';

@AdminGrpcController()
@GrpcFileAdminTransport.ControllerMethods()
export class GrpcFileAdminController implements GrpcFileAdminServiceController {
  constructor(private readonly fileService: FileProxyService) {}

  @ValidateGrpcPayload(GetUrlMapShortDto)
  getUrlMap({ ip, ...query }: NestStorage.GetUrlMapShort): Promise<NestCommon.StringMap> {
    return this.fileService.getUrlMap(query, ip);
  }

  @ValidateGrpcPayload(GetUrlMapShortDto)
  getDownloadMap({ ip, ...query }: NestStorage.GetUrlMapShort): Promise<NestStorage.DownloadMap> {
    return this.fileService.getDownloadMap(query, ip);
  }

  @ValidateGrpcPayload(IdFieldDto)
  getById({ id }: NestCommon.IdField): Promise<NestStorage.File> {
    return this.fileService.getById(id);
  }

  @ValidateGrpcPayload(GetListDto)
  getList(request: NestCommon.GetList): Promise<NestStorage.FileList> {
    return this.fileService.getList(request);
  }

  @ValidateGrpcPayload(FileCreateOneDto)
  createOne(request: NestStorage.FileCreateOne): Promise<NestStorage.File> {
    return this.fileService.createOne(request);
  }

  @ValidateGrpcPayload(FileCreateManyDto)
  createMany(request: NestStorage.FileCreateMany): Promise<NestStorage.FileArray> {
    return this.fileService.createMany(request);
  }

  @GrpcStreamMethod()
  uploadOne(
    request$: Observable<NestStorage.UploadOneShort>,
  ): Observable<NestStorage.FileUploadResponse> {
    return this.fileService.uploadOne(request$);
  }

  @ValidateGrpcPayload(IdFieldDto)
  deleteById({ id }: NestCommon.IdField): Promise<NestStorage.File> {
    return this.fileService.deleteOne({ id });
  }
}
