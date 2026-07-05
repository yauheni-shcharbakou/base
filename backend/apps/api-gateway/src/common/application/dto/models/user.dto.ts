import { NestAuth } from '@backend/proto';
import { EnumField, StringField } from '@common/application/decorators/field.decorator.dto';
import { IsEmail } from 'class-validator';
import { EntityDto } from '../entity.dto';

export class UserDto extends EntityDto implements NestAuth.User {
  @StringField()
  @IsEmail()
  email: string;

  @EnumField(NestAuth.UserRole, { enumName: 'UserRole' })
  role: NestAuth.UserRole;
}
