import { ValidateGrpcPayload } from '@backend/grpc';
import {
  GrpcFileWebServiceController,
  GrpcFileWebTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { IdFieldDto } from '@common/application/dto/id-field.dto';
import { GetUrlMapShortDto } from '@common/application/dto/storage/get-url-map.dto';
import { DefaultGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { GrpcUserId } from '@common/interface/grpc/decorators/grpc.user-id.decorator';
import { FileCreateManyWebDto } from '@modules/file/application/dto/file.create-many.dto';
import { FileCreateOneWebDto } from '@modules/file/application/dto/file.create.dto';
import { FileProxyService } from '@modules/file/application/services/file.proxy.service';
import { Payload } from '@nestjs/microservices';

@DefaultGrpcController()
@GrpcFileWebTransport.ControllerMethods()
export class GrpcFileWebController implements GrpcFileWebServiceController {
  constructor(private readonly fileService: FileProxyService) {}

  @ValidateGrpcPayload(GetUrlMapShortDto)
  getUrlMap(
    @Payload() request: NestStorage.GetUrlMapShort,
    @GrpcUserId() userId: string,
  ): Promise<NestCommon.StringMap> {
    return this.fileService.getUrlMap(request, userId);
  }

  @ValidateGrpcPayload(GetUrlMapShortDto)
  getDownloadMap(
    @Payload() request: NestStorage.GetUrlMapShort,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.DownloadMap> {
    return this.fileService.getDownloadMap(request, userId);
  }

  @ValidateGrpcPayload(FileCreateOneWebDto)
  createOne(
    @Payload() { file, storage }: NestStorage.FileCreateOneWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.FileCreated> {
    return this.fileService.createOne({ userId, file, storage });
  }

  @ValidateGrpcPayload(FileCreateManyWebDto)
  createMany(
    @Payload() { items, storage }: NestStorage.FileCreateManyWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.FileCreatedArray> {
    return this.fileService.createMany({ userId, items, storage });
  }

  @ValidateGrpcPayload(IdFieldDto)
  completeUpload(
    @Payload() { id }: NestCommon.IdField,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.File> {
    return this.fileService.completeUpload(id, userId);
  }

  @ValidateGrpcPayload(IdFieldDto)
  deleteById(
    @Payload() { id }: NestCommon.IdField,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.File> {
    return this.fileService.deleteOne({ id, userId });
  }
}
