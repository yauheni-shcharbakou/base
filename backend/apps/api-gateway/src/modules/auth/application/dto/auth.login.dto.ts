import { NestAuth } from '@backend/proto';
import { StringField } from '@common/application/decorators/field.decorator.dto';
import { IsEmail } from 'class-validator';

export class AuthLoginDto implements NestAuth.AuthLogin {
  @StringField()
  @IsEmail()
  login: string;

  @StringField()
  password: string;
}
