import { NestAuth } from '@backend/proto';
import { UpdateByIdRequestDto, UpdateDto } from '@common/application/dto/grpc-types.dto';
import { UserDto } from '@common/application/dto/models/user.dto';

export class UserUpdateDto extends UpdateDto(UserDto) implements NestAuth.UserUpdate {}

export class UserUpdateByIdRequestDto
  extends UpdateByIdRequestDto(UserUpdateDto)
  implements NestAuth.UserUpdateById {}
