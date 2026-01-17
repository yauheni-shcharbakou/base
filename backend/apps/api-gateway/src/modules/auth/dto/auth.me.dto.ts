import { ApiProperty } from '@nestjs/swagger';
import { AuthMe } from '@packages/grpc.nest';
import { IsNotEmpty, IsString } from 'class-validator';

export class AuthMeDto implements AuthMe {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  accessToken: string;
}
