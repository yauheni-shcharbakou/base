import { NestCommon, NestStorage } from '@backend/proto';
import { ULIDField } from '@common/application/decorators/field.decorator.dto';
import { ArrayMaxSize, ArrayMinSize, IsNotEmpty } from 'class-validator';

// The largest page of a folder listing — what a "select all" can hold.
const MAX_BATCH_SIZE = 100;

export class StorageObjectIdsDto implements NestCommon.IdsField {
  @ULIDField({ isArray: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BATCH_SIZE)
  ids: string[];
}

export class StorageObjectMoveByIdsDto
  extends StorageObjectIdsDto
  implements NestStorage.StorageObjectMoveByIds
{
  @ULIDField()
  @IsNotEmpty()
  parent: string;
}
