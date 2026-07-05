import { NestStorage } from '@backend/proto';
import {
  BooleanField,
  EnumField,
  StringField,
  ULIDField,
} from '@common/application/decorators/field.decorator.dto';
import { QueryDto } from '@common/application/dto/query.dto';
import { OmitType } from '@nestjs/swagger';

export class StorageObjectQueryDto extends QueryDto implements NestStorage.StorageObjectQuery {
  @EnumField(NestStorage.StorageObjectType, { required: false })
  type?: NestStorage.StorageObjectType;

  @ULIDField({ required: false })
  userId?: string;

  @BooleanField({ required: false })
  isPublic?: boolean;

  @ULIDField({ required: false })
  parent?: string;

  @ULIDField({ required: false })
  file?: string;

  @StringField({ required: false })
  name?: string;
}

export class StorageObjectQueryWebDto
  extends OmitType(StorageObjectQueryDto, ['userId', 'file'] as const)
  implements NestStorage.StorageObjectQueryWeb {}
