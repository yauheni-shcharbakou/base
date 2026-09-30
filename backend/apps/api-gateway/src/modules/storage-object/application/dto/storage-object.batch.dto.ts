import { NestStorage } from '@backend/proto';
import { ULIDField } from '@common/application/decorators/field.decorator.dto';
import { IdsFieldDto } from '@common/application/dto/ids-field.dto';
import { IsBoolean } from 'class-validator';

export class StorageObjectMoveByIdsDto
  extends IdsFieldDto
  implements NestStorage.StorageObjectMoveByIds
{
  @ULIDField()
  parent: string;
}

export class StorageObjectUpdatePublicByIdsDto
  extends IdsFieldDto
  implements NestStorage.StorageObjectUpdatePublicByIds
{
  @IsBoolean()
  isPublic: boolean;
}
