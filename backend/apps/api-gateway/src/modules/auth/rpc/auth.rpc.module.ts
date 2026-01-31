// import { GrpcModule } from '@backend/transport';
// import { Module } from '@nestjs/common';
// import { AUTH_SERVICE_NAME } from '@packages/grpc.nest';
// import { AuthRpcController } from 'modules/auth/rpc/auth.rpc.controller';
//
// @Module({
//   imports: [
//     GrpcModule.forFeature({
//       strategy: {
//         auth: [AUTH_SERVICE_NAME],
//       },
//     }),
//   ],
//   controllers: [AuthRpcController],
// })
// export class AuthRpcModule {}

import { GrpcProxyModule } from '@backend/transport';
import { Module } from '@nestjs/common';
import { grpcAuthProxyControllerFactory, grpcUserProxyControllerFactory } from '@backend/grpc';
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
        controllerFactory: grpcAuthProxyControllerFactory({
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
        controllerFactory: grpcUserProxyControllerFactory({
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
