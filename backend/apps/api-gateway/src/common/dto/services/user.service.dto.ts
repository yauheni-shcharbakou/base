import { ApiProperty } from '@nestjs/swagger';
import {
  GrpcUser,
  GrpcUserCreate,
  GrpcUserQuery,
  GrpcUserRequest,
  GrpcUserRole,
  GrpcUserUpdate,
  GrpcUserUpdateByIdRequest,
  GrpcUserUpdateRequest,
} from '@backend/grpc';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BaseQueryDto } from 'common/dto/base-query.dto';
import {
  RequestDto,
  UpdateByIdRequestDto,
  UpdateDto,
  UpdateRequestDto,
} from 'common/dto/grpc-types.dto';
import { EntityWithTimestampsDto } from 'common/dto/entity-with-timestamps.dto';

export class UserDto extends EntityWithTimestampsDto implements GrpcUser {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({ enum: GrpcUserRole, enumName: 'UserRole' })
  @IsNotEmpty()
  @IsEnum(GrpcUserRole)
  role: GrpcUserRole;
}

export class UserQueryDto extends BaseQueryDto implements GrpcUserQuery {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false, enum: GrpcUserRole, enumName: 'UserRole', isArray: true })
  @IsOptional()
  @IsEnum(GrpcUserRole, { each: true })
  roles: GrpcUserRole[] = [];
}

export class UserRequestDto extends RequestDto(UserQueryDto) implements GrpcUserRequest {}

export class UserCreateDto implements GrpcUserCreate {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({ required: false, enum: GrpcUserRole, enumName: 'UserRole' })
  @IsOptional()
  @IsEnum(GrpcUserRole)
  role?: GrpcUserRole;
}

export class UserUpdateDto extends UpdateDto(UserDto) implements GrpcUserUpdate {}

export class UserUpdateRequestDto
  extends UpdateRequestDto(UserQueryDto, UserUpdateDto)
  implements GrpcUserUpdateRequest {}

export class UserUpdateByIdRequestDto
  extends UpdateByIdRequestDto(UserUpdateDto)
  implements GrpcUserUpdateByIdRequest {}
