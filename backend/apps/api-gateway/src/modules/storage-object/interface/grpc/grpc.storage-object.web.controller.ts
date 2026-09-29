import { ValidateGrpcPayload } from '@backend/grpc';
import {
  GrpcStorageObjectWebServiceController,
  GrpcStorageObjectWebTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { IdFieldDto } from '@common/application/dto/id-field.dto';
import { DefaultGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { GrpcUserId } from '@common/interface/grpc/decorators/grpc.user-id.decorator';
import { StorageObjectCreateWebDto } from '@modules/storage-object/application/dto/storage-object.create.dto';
import { StorageObjectGetFoldersWebDto } from '@modules/storage-object/application/dto/storage-object.get-folders.dto';
import { StorageObjectQueryWebDto } from '@modules/storage-object/application/dto/storage-object.query.dto';
import { StorageObjectUpdateByIdDto } from '@modules/storage-object/application/dto/storage-object.update.dto';
import { StorageObjectProxyService } from '@modules/storage-object/application/services/storage-object.proxy.service';
import { Payload } from '@nestjs/microservices';

@DefaultGrpcController()
@GrpcStorageObjectWebTransport.ControllerMethods()
export class GrpcStorageObjectWebController implements GrpcStorageObjectWebServiceController {
  constructor(private readonly storageObjectService: StorageObjectProxyService) {}

  @ValidateGrpcPayload(StorageObjectGetFoldersWebDto)
  getFolders(
    @Payload() request: NestStorage.StorageObjectGetFoldersWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.StorageObjectArray> {
    return this.storageObjectService.getFolders({ ...request, userId });
  }

  @ValidateGrpcPayload(StorageObjectQueryWebDto)
  isExists(
    @Payload() request: NestStorage.StorageObjectQueryWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestCommon.Boolean> {
    return this.storageObjectService.isExists({ ...request, userId });
  }

  @ValidateGrpcPayload(StorageObjectCreateWebDto)
  createOne(
    @Payload() request: NestStorage.StorageObjectCreateWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.StorageObject> {
    return this.storageObjectService.createOne({ ...request, userId });
  }

  @ValidateGrpcPayload(StorageObjectUpdateByIdDto)
  updateById(
    @Payload() { id, update }: NestStorage.StorageObjectUpdateById,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.StorageObject> {
    return this.storageObjectService.updateOne({ id, userId }, update);
  }

  @ValidateGrpcPayload(IdFieldDto)
  deleteById(
    @Payload() { id }: NestCommon.IdField,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.StorageObject> {
    return this.storageObjectService.deleteOne({ id, userId });
  }
}
