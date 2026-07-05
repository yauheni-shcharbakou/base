import { NestAuth } from '@backend/proto';
import { EnumField, StringField } from '@common/application/decorators/field.decorator.dto';
import { IsEmail } from 'class-validator';

export class UserCreateDto implements NestAuth.UserCreate {
  @StringField()
  @IsEmail()
  email: string;

  @StringField()
  password: string;

  @EnumField(NestAuth.UserRole, { required: false, enumName: 'UserRole' })
  role?: NestAuth.UserRole;
}
