import { NestStorage } from '@backend/proto';
import { ObjectField, StringField } from '@common/application/decorators/field.decorator.dto';
import { UpdateByIdRequestDto } from '@common/application/dto/grpc-types.dto';

class ImageUpdateSetDto implements NestStorage.ImageUpdateSet {
  @StringField({ required: false })
  alt?: string;
}

class ImageUpdateDto implements NestStorage.ImageUpdate {
  @ObjectField(ImageUpdateSetDto, { required: false })
  set?: ImageUpdateSetDto;
}

export class ImageUpdateByIdDto
  extends UpdateByIdRequestDto(ImageUpdateDto)
  implements NestStorage.ImageUpdateById {}
