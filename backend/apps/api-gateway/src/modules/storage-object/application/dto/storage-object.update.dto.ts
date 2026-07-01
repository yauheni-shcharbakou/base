import { NestStorage } from '@backend/proto';
import {
  BooleanField,
  ObjectField,
  StringField,
  ULIDField,
} from '@common/application/decorators/field.decorator.dto';
import { UpdateByIdRequestDto } from '@common/application/dto/grpc-types.dto';

class StorageObjectUpdateSetDto implements NestStorage.StorageObjectUpdateSet {
  @StringField({ required: false })
  name?: string;

  @BooleanField({ required: false })
  isPublic?: boolean;

  @ULIDField({ required: false })
  parent?: string;
}

class StorageObjectUpdateDto implements NestStorage.StorageObjectUpdate {
  @ObjectField(StorageObjectUpdateSetDto, { required: false })
  set?: StorageObjectUpdateSetDto;
}

export class StorageObjectUpdateByIdDto
  extends UpdateByIdRequestDto(StorageObjectUpdateDto)
  implements NestStorage.StorageObjectUpdateById {}
