import { ApiProperty } from '@nestjs/swagger';
import { AuthLogin, AuthMe, AuthRefresh, AuthToken, AuthTokens } from '@backend/grpc';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator';

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

export class AuthMeDto implements AuthMe {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  accessToken: string;
}

export class AuthRefreshDto implements AuthRefresh {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

export class AuthTokenDto implements AuthToken {
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

export class AuthTokensDto implements AuthTokens {
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
