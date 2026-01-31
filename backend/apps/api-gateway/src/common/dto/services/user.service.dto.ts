import { ApiProperty } from '@nestjs/swagger';
import {
  User,
  UserCreate,
  UserQuery,
  UserRequest,
  UserRole,
  UserUpdate,
  UserUpdateByIdRequest,
  UserUpdateRequest,
} from '@backend/grpc';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BaseQueryDto } from 'common/dto/base-query.dto';
import {
  RequestDto,
  UpdateByIdRequestDto,
  UpdateDto,
  UpdateRequestDto,
} from 'common/dto/data-types.dto';
import { EntityWithTimestampsDto } from 'common/dto/entity-with-timestamps.dto';
import { IdFieldDto } from 'common/dto/id-field.dto';

export class UserDto extends EntityWithTimestampsDto implements User {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;
}

export class UserQueryDto extends BaseQueryDto implements UserQuery {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false, enum: UserRole, enumName: 'UserRole', isArray: true })
  @IsOptional()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[] = [];
}

export class UserRequestDto extends RequestDto(UserQueryDto) implements UserRequest {}

export class UserCreateDto implements UserCreate {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({ required: false, enum: UserRole, enumName: 'UserRole' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class UserUpdateDto extends UpdateDto(UserDto) implements UserUpdate {}

export class UserUpdateRequestDto
  extends UpdateRequestDto(UserQueryDto, UserUpdateDto)
  implements UserUpdateRequest {}

export class UserUpdateByIdRequestDto
  extends UpdateByIdRequestDto(UserUpdateDto)
  implements UserUpdateByIdRequest {}
