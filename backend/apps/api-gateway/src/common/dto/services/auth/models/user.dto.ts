import { ApiProperty } from '@nestjs/swagger';
import { GrpcUser, GrpcUserRole } from '@backend/grpc';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
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
