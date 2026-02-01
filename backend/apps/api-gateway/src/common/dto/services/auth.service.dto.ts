import { ApiProperty } from '@nestjs/swagger';
import {
  GrpcAuthLogin,
  GrpcAuthMe,
  GrpcAuthRefresh,
  GrpcAuthToken,
  GrpcAuthTokens,
} from '@backend/grpc';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator';

export class AuthLoginDto implements GrpcAuthLogin {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  login: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  password: string;
}

export class AuthMeDto implements GrpcAuthMe {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  accessToken: string;
}

export class AuthRefreshDto implements GrpcAuthRefresh {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

export class AuthTokenDto implements GrpcAuthToken {
  @ApiProperty({ type: Date })
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  expireDate: Date;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  value: string;
}

export class AuthTokensDto implements GrpcAuthTokens {
  @ApiProperty({ type: AuthTokenDto })
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => AuthTokenDto)
  accessToken: AuthTokenDto;

  @ApiProperty({ type: AuthTokenDto })
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => AuthTokenDto)
  refreshToken: AuthTokenDto;
}
