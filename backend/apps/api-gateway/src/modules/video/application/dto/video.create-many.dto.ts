import { NestStorage } from '@backend/proto';
import {
  ObjectField,
  StringField,
  ULIDField,
} from '@common/application/decorators/field.decorator.dto';
import { StorageManyMetaDto } from '@common/application/dto/storage/storage-meta.dto';
import { FileCreateDto } from '@modules/file/application/dto/file.create.dto';
import { OmitType } from '@nestjs/swagger';
import { VideoCreateDto } from './video.create.dto';

class VideoCreateManyItemDto implements NestStorage.VideoCreateManyItem {
  @ObjectField(VideoCreateDto)
  video: VideoCreateDto;

  @ObjectField(FileCreateDto)
  file: FileCreateDto;

  @StringField()
  uploadId: string;
}

export class VideoCreateManyDto implements NestStorage.VideoCreateMany {
  @ObjectField(StorageManyMetaDto, { required: false })
  storage?: StorageManyMetaDto;

  @ObjectField(VideoCreateManyItemDto, { isArray: true })
  items: VideoCreateManyItemDto[];

  @ULIDField()
  userId: string;
}

export class VideoCreateManyWebDto
  extends OmitType(VideoCreateManyDto, ['userId'] as const)
  implements NestStorage.VideoCreateManyWeb {}
