import { NestCommon } from '@backend/proto';
import { ULIDField } from '../decorators/field.decorator.dto';

export class UserIdFieldDto implements NestCommon.UserIdField {
  @ULIDField()
  userId: string;
}
