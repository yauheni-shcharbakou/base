import { GrpcModule, GrpcProxyModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { GrpcAuthService, GrpcTempCodeService, GrpcUserService } from '@backend/grpc';
import { AdminGrpcController } from 'common/decorators/access.decorator';
import { GetListRequestDto } from 'common/dto/get-list-request.dto';
import { IdFieldDto } from 'common/dto/id-field.dto';
import {
  UserCreateDto,
  UserRequestDto,
  UserUpdateByIdRequestDto,
} from 'common/dto/services/auth/user.service.dto';
import { AuthRpcController } from 'modules/auth/rpc/controllers/auth.rpc.controller';

@Module({
  imports: [
    GrpcProxyModule.register(
      {
        host: 'auth',
        controllerFactory: GrpcTempCodeService.proxyFactory({
          getById: IdFieldDto,
          getList: GetListRequestDto,
          deleteById: IdFieldDto,
        }),
        custom: {
          GrpcController: AdminGrpcController,
        },
      },
      {
        host: 'auth',
        controllerFactory: GrpcUserService.proxyFactory({
          getById: IdFieldDto,
          getOne: UserRequestDto,
          getMany: UserRequestDto,
          getList: GetListRequestDto,
          createOne: UserCreateDto,
          updateById: UserUpdateByIdRequestDto,
          deleteById: IdFieldDto,
        }),
        custom: {
          GrpcController: AdminGrpcController,
        },
      },
    ),
    GrpcModule.forFeature({
      strategy: {
        auth: [GrpcAuthService.name, GrpcTempCodeService.name],
      },
    }),
  ],
  controllers: [AuthRpcController],
})
export class AuthRpcModule {}
