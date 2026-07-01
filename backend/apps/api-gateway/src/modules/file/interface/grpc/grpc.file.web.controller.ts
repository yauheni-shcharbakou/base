import { ValidateGrpcPayload } from '@backend/grpc';
import {
  GrpcFileWebServiceController,
  GrpcFileWebTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { IdFieldDto } from '@common/application/dto/id-field.dto';
import { GetUrlMapWebDto } from '@common/application/dto/storage/get-url-map.dto';
import { DefaultGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { GrpcStreamMethod } from '@common/interface/grpc/decorators/grpc.stream-method.decorator';
import { GrpcUserId } from '@common/interface/grpc/decorators/grpc.user-id.decorator';
import { FileCreateManyWebDto } from '@modules/file/application/dto/file.create-many.dto';
import { FileCreateOneWebDto } from '@modules/file/application/dto/file.create.dto';
import { FileProxyService } from '@modules/file/application/services/file.proxy.service';
import { Observable } from 'rxjs';

@DefaultGrpcController()
@GrpcFileWebTransport.ControllerMethods()
export class GrpcFileWebController implements GrpcFileWebServiceController {
  constructor(private readonly fileService: FileProxyService) {}

  @ValidateGrpcPayload(GetUrlMapWebDto)
  getUrlMap(
    { ip, ...query }: NestStorage.GetUrlMapWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestCommon.StringMap> {
    return this.fileService.getUrlMap(query, userId, ip);
  }

  @ValidateGrpcPayload(GetUrlMapWebDto)
  getDownloadMap(
    { ip, ...query }: NestStorage.GetUrlMapWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.DownloadMap> {
    return this.fileService.getDownloadMap(query, userId, ip);
  }

  @ValidateGrpcPayload(FileCreateOneWebDto)
  createOne(
    { file, storage }: NestStorage.FileCreateOneWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.File> {
    return this.fileService.createOne({ userId, file, storage });
  }

  @ValidateGrpcPayload(FileCreateManyWebDto)
  createMany(
    { items, storage }: NestStorage.FileCreateManyWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.FileArray> {
    return this.fileService.createMany({ userId, items, storage });
  }

  @GrpcStreamMethod()
  uploadOne(
    request$: Observable<NestStorage.UploadOneWeb>,
    @GrpcUserId() userId: string,
  ): Observable<NestStorage.FileUploadResponse> {
    return this.fileService.uploadOne(request$, userId);
  }

  @ValidateGrpcPayload(IdFieldDto)
  deleteById({ id }: NestCommon.IdField, @GrpcUserId() userId: string): Promise<NestStorage.File> {
    return this.fileService.deleteOne({ id, userId });
  }
}
