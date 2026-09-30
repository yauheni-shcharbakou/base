import { ValidateGrpcPayload } from '@backend/grpc';
import {
  GrpcStorageObjectAdminServiceController,
  GrpcStorageObjectAdminTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { GetListDto } from '@common/application/dto/get-list.dto';
import { IdFieldDto } from '@common/application/dto/id-field.dto';
import { IdsFieldDto } from '@common/application/dto/ids-field.dto';
import { UserIdFieldDto } from '@common/application/dto/user-id-field.dto';
import { AdminGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { StorageObjectMoveByIdsDto } from '@modules/storage-object/application/dto/storage-object.batch.dto';
import { StorageObjectCreateFoldersDto } from '@modules/storage-object/application/dto/storage-object.create-folders.dto';
import { StorageObjectCreateDto } from '@modules/storage-object/application/dto/storage-object.create.dto';
import { StorageObjectGetFolderContentDto } from '@modules/storage-object/application/dto/storage-object.get-folder-content.dto';
import { StorageObjectGetFoldersDto } from '@modules/storage-object/application/dto/storage-object.get-folders.dto';
import { StorageObjectQueryDto } from '@modules/storage-object/application/dto/storage-object.query.dto';
import { StorageObjectUpdateByIdDto } from '@modules/storage-object/application/dto/storage-object.update.dto';
import { StorageObjectProxyService } from '@modules/storage-object/application/services/storage-object.proxy.service';

@AdminGrpcController()
@GrpcStorageObjectAdminTransport.ControllerMethods()
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

  @ValidateGrpcPayload(StorageObjectGetFolderContentDto)
  getFolderContent(
    request: NestStorage.StorageObjectGetFolderContent,
  ): Promise<NestStorage.StorageObjectFolderContent> {
    return this.storageObjectService.getFolderContent(request);
  }

  @ValidateGrpcPayload(UserIdFieldDto)
  getRootFolder({ userId }: NestCommon.UserIdField): Promise<NestStorage.StorageObject> {
    return this.storageObjectService.getRootFolder(userId);
  }

  @ValidateGrpcPayload(StorageObjectQueryDto)
  isExists(request: NestStorage.StorageObjectQuery): Promise<NestCommon.Boolean> {
    return this.storageObjectService.isExists(request);
  }

  @ValidateGrpcPayload(StorageObjectCreateDto)
  createOne(request: NestStorage.StorageObjectCreate): Promise<NestStorage.StorageObject> {
    return this.storageObjectService.createOne(request);
  }

  @ValidateGrpcPayload(StorageObjectCreateFoldersDto)
  createFolders(
    request: NestStorage.StorageObjectCreateFolders,
  ): Promise<NestStorage.StorageObjectArray> {
    return this.storageObjectService.createFolders(request);
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

  @ValidateGrpcPayload(IdsFieldDto)
  deleteByIds({ ids }: NestCommon.IdsField): Promise<NestStorage.StorageObjectArray> {
    return this.storageObjectService.deleteMany(ids);
  }

  @ValidateGrpcPayload(StorageObjectMoveByIdsDto)
  moveByIds({
    ids,
    parent,
  }: NestStorage.StorageObjectMoveByIds): Promise<NestStorage.StorageObjectArray> {
    return this.storageObjectService.moveMany(ids, parent);
  }
}
