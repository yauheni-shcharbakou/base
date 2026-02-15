import { GrpcProxyModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { GrpcFileService, GrpcUserRole } from '@backend/grpc';
import { AdminGrpcController } from 'common/decorators/access.decorator';
import { GrpcProxyStreamMethod } from 'common/decorators/grpc-proxy-method.decorator';
import { BaseQueryDto } from 'common/dto/base-query.dto';
import { GetListRequestDto } from 'common/dto/get-list-request.dto';
import { IdFieldDto } from 'common/dto/id-field.dto';
import { FileCreateDto, FileUpdateByIdRequestDto } from 'common/dto/services/file.service.dto';

@Module({
  imports: [
    GrpcProxyModule.register({
      host: 'file',
      controllerFactory: GrpcFileService.proxyFactory({
        getSignedUrls: BaseQueryDto,
        getById: IdFieldDto,
        getList: GetListRequestDto,
        createOne: FileCreateDto,
        uploadOne: {
          allowedRoles: [GrpcUserRole.ADMIN],
        },
        updateById: FileUpdateByIdRequestDto,
        deleteById: IdFieldDto,
      }),
      custom: {
        GrpcController: AdminGrpcController,
        GrpcStreamMethod: GrpcProxyStreamMethod,
      },
    }),
  ],
})
export class FileRpcModule {}
