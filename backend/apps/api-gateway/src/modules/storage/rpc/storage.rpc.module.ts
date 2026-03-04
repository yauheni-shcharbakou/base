import { GrpcProxyModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import {
  GrpcFileService,
  GrpcImageService,
  GrpcStorageObjectService,
  GrpcVideoService,
} from '@backend/grpc';
import { AdminAccess, AdminGrpcController } from 'common/decorators/access.decorator';
import { GrpcProxyStreamMethod } from 'common/decorators/grpc-proxy-method.decorator';
import { GetListRequestDto } from 'common/dto/get-list-request.dto';
import { IdFieldDto } from 'common/dto/id-field.dto';
import {
  StorageObjectCreateDto,
  StorageObjectRequestDto,
  StorageObjectUpdateByIdRequestDto,
} from 'common/dto/services/storage/storage-object.service.dto';

@Module({
  imports: [
    GrpcProxyModule.register(
      {
        host: 'storage',
        controllerFactory: GrpcFileService.proxyFactory({
          getById: IdFieldDto,
          getList: GetListRequestDto,
          uploadOne: {
            decorators: [AdminAccess()],
          },
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
          // deleteById: IdFieldDto,
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
          getById: IdFieldDto,
          getList: GetListRequestDto,
          // deleteById: IdFieldDto,
        }),
        custom: {
          GrpcController: AdminGrpcController,
          GrpcStreamMethod: GrpcProxyStreamMethod,
        },
      },
    ),
    // GrpcModule.forFeature({
    //   strategy: {
    //     storage: [GrpcFileService.name],
    //   },
    // }),
    // StorageServiceModule,
  ],
  // controllers: [FileRpcController],
})
export class StorageRpcModule {}
