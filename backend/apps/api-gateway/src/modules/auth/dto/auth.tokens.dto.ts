import { ApiProperty } from '@nestjs/swagger';
import { AuthTokens } from '@packages/grpc.nest';
import { IsNotEmpty, IsString } from 'class-validator';

export class AuthTokensDto implements AuthTokens {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  accessToken: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}
