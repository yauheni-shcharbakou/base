import { NestAuth } from '@backend/proto';
import { ULIDField } from '@common/application/decorators/field.decorator.dto';

export class TempCodeCreateDto implements NestAuth.TempCodeCreate {
  @ULIDField()
  user: string;
}
