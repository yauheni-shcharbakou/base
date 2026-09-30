import { NestCommon } from '@backend/proto';
import { ArrayMaxSize, ArrayMinSize } from 'class-validator';
import { ULIDField } from '../decorators/field.decorator.dto';

// The largest page of a folder listing — what a "select all" can hold, and what one batch call takes.
export const MAX_BATCH_SIZE = 100;

/** The ids of a batch call: 1–100. An empty list would read as "no filter" further down. */
export class IdsFieldDto implements NestCommon.IdsField {
  @ULIDField({ isArray: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BATCH_SIZE)
  ids: string[];
}
