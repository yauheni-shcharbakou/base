import { GrpcModule, GrpcProxyModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import {
  GrpcFileService,
  GrpcImageService,
  GrpcStorageObjectService,
  GrpcVideoService,
} from '@backend/grpc';
import { AdminGrpcController } from 'common/decorators/access.decorator';
import { GetListRequestDto } from 'common/dto/get-list-request.dto';
import { IdFieldDto } from 'common/dto/id-field.dto';
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
import { FileRpcController } from 'modules/storage/rpc/controllers/file.rpc.controller';
import { VideoRpcController } from 'modules/storage/rpc/controllers/video.rpc.controller';

@Module({
  imports: [
    GrpcProxyModule.register(
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
    ),
    GrpcModule.forFeature({
      strategy: {
        storage: [GrpcFileService.name, GrpcVideoService.name],
      },
    }),
  ],
  controllers: [FileRpcController, VideoRpcController],
})
export class StorageRpcModule {}
