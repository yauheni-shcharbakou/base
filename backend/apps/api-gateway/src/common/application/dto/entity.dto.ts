import { NestCommon } from '@backend/proto';
import { DateField } from '../decorators/field.decorator.dto';
import { IdFieldDto } from './id-field.dto';

export class EntityDto extends IdFieldDto implements NestCommon.Entity {
  @DateField()
  createdAt: Date;

  @DateField({ required: false })
  updatedAt?: Date;
}
