import { NestCommon } from '@backend/proto';
import { ULIDField } from '../decorators/field.decorator.dto';

export class IdFieldDto implements NestCommon.IdField {
  @ULIDField()
  id: string;
}
