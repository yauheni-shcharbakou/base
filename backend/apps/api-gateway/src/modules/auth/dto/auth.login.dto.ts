import { ApiProperty } from '@nestjs/swagger';
import { AuthLogin } from '@packages/grpc.nest';
import { IsNotEmpty, IsString } from 'class-validator';

export class AuthLoginDto implements AuthLogin {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  login: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  password: string;
}
