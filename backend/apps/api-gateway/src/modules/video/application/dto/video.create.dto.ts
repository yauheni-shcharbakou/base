import { NestStorage } from '@backend/proto';
import {
  ObjectField,
  StringField,
  ULIDField,
} from '@common/application/decorators/field.decorator.dto';
import { StorageMetaDto } from '@common/application/dto/storage/storage-meta.dto';
import { FileCreateDto } from '@modules/file/application/dto/file.create.dto';
import { OmitType } from '@nestjs/swagger';

export class VideoCreateDto implements NestStorage.VideoCreate {
  @StringField()
  title: string;

  @StringField({ required: false })
  description?: string;
}

export class VideoCreateOneDto implements NestStorage.VideoCreateOne {
  @ObjectField(VideoCreateDto)
  video: VideoCreateDto;

  @ObjectField(FileCreateDto)
  file: FileCreateDto;

  @ObjectField(StorageMetaDto, { required: false })
  storage?: StorageMetaDto;

  @ULIDField()
  userId: string;
}

export class VideoCreateOneWebDto
  extends OmitType(VideoCreateOneDto, ['userId'] as const)
  implements NestStorage.VideoCreateOneWeb {}
