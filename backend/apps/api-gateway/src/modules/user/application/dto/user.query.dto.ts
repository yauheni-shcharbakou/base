import { NestAuth } from '@backend/proto';
import { EnumField, StringField } from '@common/application/decorators/field.decorator.dto';
import { QueryDto } from '@common/application/dto/query.dto';
import { ArrayMaxSize, IsEmail } from 'class-validator';

export class UserQueryDto extends QueryDto implements NestAuth.UserQuery {
  @StringField({ required: false })
  @IsEmail()
  email?: string;

  @EnumField(NestAuth.UserRole, { enumName: 'UserRole', required: false, isArray: true })
  @ArrayMaxSize(Object.keys(NestAuth.UserRole).length)
  roles: NestAuth.UserRole[] = [];
}
