import { ValidateGrpcPayload } from '@backend/grpc';
import {
  GrpcUserAdminServiceController,
  GrpcUserAdminTransport,
  NestAuth,
  NestCommon,
} from '@backend/proto';
import { GetListDto } from '@common/application/dto/get-list.dto';
import { IdFieldDto } from '@common/application/dto/id-field.dto';
import { AdminGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { UserCreateDto } from '@modules/user/application/dto/user.create.dto';
import { UserUpdateByIdRequestDto } from '@modules/user/application/dto/user.update.dto';
import { UserProxyService } from '@modules/user/application/services/user.proxy.service';

@AdminGrpcController()
@GrpcUserAdminTransport.ControllerMethods()
export class GrpcUserAdminController implements GrpcUserAdminServiceController {
  constructor(private readonly userService: UserProxyService) {}

  @ValidateGrpcPayload(IdFieldDto)
  getById({ id }: NestCommon.IdField): Promise<NestAuth.User> {
    return this.userService.getById(id);
  }

  @ValidateGrpcPayload(GetListDto)
  getList(request: NestCommon.GetList): Promise<NestAuth.UserList> {
    return this.userService.getList(request);
  }

  @ValidateGrpcPayload(UserCreateDto)
  createOne(request: NestAuth.UserCreate): Promise<NestAuth.User> {
    return this.userService.createOne(request);
  }

  @ValidateGrpcPayload(UserUpdateByIdRequestDto)
  updateById({ id, update }: NestAuth.UserUpdateById): Promise<NestAuth.User> {
    return this.userService.updateById(id, update);
  }

  @ValidateGrpcPayload(IdFieldDto)
  deleteById({ id }: NestCommon.IdField): Promise<NestAuth.User> {
    return this.userService.deleteById(id);
  }
}
