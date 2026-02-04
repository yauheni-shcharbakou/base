import { GrpcProxyModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { GrpcAuthService, GrpcUserService } from '@backend/grpc';
import { AdminGrpcController, PublicGrpcController } from 'common/decorators/access.decorator';
import { GetListRequestDto } from 'common/dto/get-list-request.dto';
import { IdFieldDto } from 'common/dto/id-field.dto';
import { AuthLoginDto, AuthMeDto, AuthRefreshDto } from 'common/dto/services/auth.service.dto';
import {
  UserCreateDto,
  UserRequestDto,
  UserUpdateByIdRequestDto,
  UserUpdateRequestDto,
} from 'common/dto/services/user.service.dto';

@Module({
  imports: [
    GrpcProxyModule.register(
      {
        host: 'auth',
        controllerFactory: GrpcAuthService.proxyFactory({
          me: AuthMeDto,
          login: AuthLoginDto,
          refreshToken: AuthRefreshDto,
        }),
        custom: {
          GrpcController: PublicGrpcController,
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
          updateOne: UserUpdateRequestDto,
          deleteOne: UserRequestDto,
          updateById: UserUpdateByIdRequestDto,
          deleteById: IdFieldDto,
        }),
        custom: {
          GrpcController: AdminGrpcController,
        },
      },
    ),
  ],
})
export class AuthRpcModule {}
