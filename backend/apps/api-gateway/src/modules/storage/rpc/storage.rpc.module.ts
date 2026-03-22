import { GrpcProxyModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import {
  GrpcFileService,
  GrpcImageService,
  GrpcStorageObjectService,
  GrpcVideoService,
} from '@backend/grpc';
import { AdminGrpcController } from 'common/decorators/access.decorator';
import { GrpcProxyStreamMethod } from 'common/decorators/grpc-proxy-method.decorator';
import { BaseQueryDto } from 'common/dto/base-query.dto';
import { GetListRequestDto } from 'common/dto/get-list-request.dto';
import { IdFieldDto } from 'common/dto/id-field.dto';
import {
  ImageCreateRequestDto,
  ImageUpdateByIdRequestDto,
} from 'common/dto/services/storage/image.service.dto';
import { FileCreateDto } from 'common/dto/services/storage/models/file.dto';
import {
  StorageObjectCreateDto,
  StorageObjectExistsFolderRequestDto,
  StorageObjectRequestDto,
  StorageObjectUpdateByIdRequestDto,
} from 'common/dto/services/storage/storage-object.service.dto';
import {
  VideoCreateRequestDto,
  VideoUpdateByIdRequestDto,
} from 'common/dto/services/storage/video.service.dto';

@Module({
  imports: [
    GrpcProxyModule.register(
      {
        host: 'storage',
        controllerFactory: GrpcFileService.proxyFactory({
          getUrlMap: BaseQueryDto,
          getDownloadMap: BaseQueryDto,
          getById: IdFieldDto,
          getList: GetListRequestDto,
          createOne: FileCreateDto,
          deleteById: IdFieldDto,
        }),
        custom: {
          GrpcController: AdminGrpcController,
          GrpcStreamMethod: GrpcProxyStreamMethod,
        },
      },
      {
        host: 'storage',
        controllerFactory: GrpcImageService.proxyFactory({
          getById: IdFieldDto,
          getList: GetListRequestDto,
          createOne: ImageCreateRequestDto,
          updateById: ImageUpdateByIdRequestDto,
          deleteById: IdFieldDto,
        }),
        custom: {
          GrpcController: AdminGrpcController,
        },
      },
      {
        host: 'storage',
        controllerFactory: GrpcStorageObjectService.proxyFactory({
          getById: IdFieldDto,
          getMany: StorageObjectRequestDto,
          getList: GetListRequestDto,
          isExistsFolder: StorageObjectExistsFolderRequestDto,
          createOne: StorageObjectCreateDto,
          updateById: StorageObjectUpdateByIdRequestDto,
          deleteById: IdFieldDto,
        }),
        custom: {
          GrpcController: AdminGrpcController,
        },
      },
      {
        host: 'storage',
        controllerFactory: GrpcVideoService.proxyFactory({
          getUrlMap: BaseQueryDto,
          getDownloadMap: BaseQueryDto,
          getById: IdFieldDto,
          getList: GetListRequestDto,
          createOne: VideoCreateRequestDto,
          updateById: VideoUpdateByIdRequestDto,
          deleteById: IdFieldDto,
        }),
        custom: {
          GrpcController: AdminGrpcController,
          GrpcStreamMethod: GrpcProxyStreamMethod,
        },
      },
    ),
  ],
})
export class StorageRpcModule {}
