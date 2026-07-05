import { NestCommon } from '@backend/proto';
import { ArrayMaxSize } from 'class-validator';
import { ULIDField } from '../decorators/field.decorator.dto';

export class QueryDto implements NestCommon.Query {
  @ULIDField({ required: false })
  id?: string;

  @ULIDField({ required: false, isArray: true })
  @ArrayMaxSize(100)
  ids: string[] = [];
}
