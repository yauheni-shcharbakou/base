import { ValidateGrpcPayload } from '@backend/grpc';
import {
  GrpcStorageObjectAdminServiceController,
  GrpcStorageObjectTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { GetListDto } from '@common/application/dto/get-list.dto';
import { IdFieldDto } from '@common/application/dto/id-field.dto';
import { AdminGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { StorageObjectCreateDto } from '@modules/storage-object/application/dto/storage-object.create.dto';
import { StorageObjectGetFoldersDto } from '@modules/storage-object/application/dto/storage-object.get-folders.dto';
import { StorageObjectQueryDto } from '@modules/storage-object/application/dto/storage-object.query.dto';
import { StorageObjectUpdateByIdDto } from '@modules/storage-object/application/dto/storage-object.update.dto';
import { StorageObjectProxyService } from '@modules/storage-object/application/services/storage-object.proxy.service';

@AdminGrpcController()
@GrpcStorageObjectTransport.ControllerMethods()
export class GrpcStorageObjectAdminController implements GrpcStorageObjectAdminServiceController {
  constructor(private readonly storageObjectService: StorageObjectProxyService) {}

  @ValidateGrpcPayload(IdFieldDto)
  getById({ id }: NestCommon.IdField): Promise<NestStorage.StorageObjectPopulated> {
    return this.storageObjectService.getById(id);
  }

  @ValidateGrpcPayload(StorageObjectQueryDto)
  getMany(request: NestStorage.StorageObjectQuery): Promise<NestStorage.StorageObjectArray> {
    return this.storageObjectService.getMany(request);
  }

  @ValidateGrpcPayload(GetListDto)
  getList(request: NestCommon.GetList): Promise<NestStorage.StorageObjectList> {
    return this.storageObjectService.getList(request);
  }

  @ValidateGrpcPayload(StorageObjectGetFoldersDto)
  getFolders(
    request: NestStorage.StorageObjectGetFolders,
  ): Promise<NestStorage.StorageObjectArray> {
    return this.storageObjectService.getFolders(request);
  }

  @ValidateGrpcPayload(StorageObjectQueryDto)
  isExists(request: NestStorage.StorageObjectQuery): Promise<NestCommon.Boolean> {
    return this.storageObjectService.isExists(request);
  }

  @ValidateGrpcPayload(StorageObjectCreateDto)
  createOne(request: NestStorage.StorageObjectCreate): Promise<NestStorage.StorageObject> {
    return this.storageObjectService.createOne(request);
  }

  @ValidateGrpcPayload(StorageObjectUpdateByIdDto)
  updateById({
    id,
    update,
  }: NestStorage.StorageObjectUpdateById): Promise<NestStorage.StorageObject> {
    return this.storageObjectService.updateOne({ id }, update);
  }

  @ValidateGrpcPayload(IdFieldDto)
  deleteById({ id }: NestCommon.IdField): Promise<NestStorage.StorageObject> {
    return this.storageObjectService.deleteOne({ id });
  }
}
