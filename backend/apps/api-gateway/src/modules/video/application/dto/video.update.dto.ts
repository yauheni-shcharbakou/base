import { NestStorage } from '@backend/proto';
import { ObjectField, StringField } from '@common/application/decorators/field.decorator.dto';
import { UpdateByIdRequestDto } from '@common/application/dto/grpc-types.dto';

class VideoUpdateSetDto implements NestStorage.VideoUpdateSet {
  @StringField({ required: false })
  title?: string;

  @StringField({ required: false })
  description?: string;
}

class VideoUpdateDto implements NestStorage.VideoUpdate {
  @ObjectField(VideoUpdateSetDto, { required: false })
  set?: VideoUpdateSetDto;
}

export class VideoUpdateByIdDto
  extends UpdateByIdRequestDto(VideoUpdateDto)
  implements NestStorage.VideoUpdateById {}
