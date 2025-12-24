import { ApiProperty } from '@nestjs/swagger';
import { AuthRefresh } from '@packages/grpc.nest';
import { IsNotEmpty, IsString } from 'class-validator';

export class AuthRefreshDto implements AuthRefresh {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}
