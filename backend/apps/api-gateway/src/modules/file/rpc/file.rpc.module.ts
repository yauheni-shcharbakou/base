import { GrpcProxyModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { GrpcFileService } from '@backend/grpc';
import { AdminGrpcController, PublicAccess } from 'common/decorators/access.decorator';
import { GetListRequestDto } from 'common/dto/get-list-request.dto';
import { IdFieldDto } from 'common/dto/id-field.dto';
import { FileCreateDto, FileUpdateByIdRequestDto } from 'common/dto/services/file.service.dto';

@Module({
  imports: [
    GrpcProxyModule.register({
      host: 'file',
      controllerFactory: GrpcFileService.proxyFactory({
        getById: IdFieldDto,
        getList: GetListRequestDto,
        createOne: FileCreateDto,
        uploadOne: {
          decorators: [PublicAccess()],
        },
        updateById: FileUpdateByIdRequestDto,
        deleteById: IdFieldDto,
      }),
      custom: {
        GrpcController: AdminGrpcController,
      },
    }),
  ],
})
export class FileRpcModule {}
