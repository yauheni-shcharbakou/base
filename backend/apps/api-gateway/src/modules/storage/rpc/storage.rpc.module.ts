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
  FileCreateManyRequestDto,
  FileCreateRequestDto,
} from 'common/dto/services/storage/file.service.dto';
import {
  ImageCreateManyRequestDto,
  ImageCreateRequestDto,
  ImageUpdateByIdRequestDto,
} from 'common/dto/services/storage/image.service.dto';
import {
  StorageObjectCreateDto,
  StorageObjectExistsFolderRequestDto,
  StorageObjectRequestDto,
  StorageObjectUpdateByIdRequestDto,
} from 'common/dto/services/storage/storage-object.service.dto';
import {
  VideoCreateManyRequestDto,
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
          createOne: FileCreateRequestDto,
          createMany: FileCreateManyRequestDto,
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
          createMany: ImageCreateManyRequestDto,
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
          createMany: VideoCreateManyRequestDto,
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
