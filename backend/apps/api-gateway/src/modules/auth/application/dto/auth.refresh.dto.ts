import { NestAuth } from '@backend/proto';
import { StringField } from '@common/application/decorators/field.decorator.dto';

export class AuthRefreshDto implements NestAuth.AuthRefresh {
  @StringField()
  refreshToken: string;
}
