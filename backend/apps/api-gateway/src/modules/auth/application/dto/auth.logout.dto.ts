import { NestAuth } from '@backend/proto';
import { StringField } from '@common/application/decorators/field.decorator.dto';

export class AuthLogoutDto implements NestAuth.AuthLogout {
  @StringField()
  refreshToken: string;
}
