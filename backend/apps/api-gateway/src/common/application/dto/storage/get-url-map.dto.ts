import { NestStorage } from '@backend/proto';
import { StringField, ULIDField } from '@common/application/decorators/field.decorator.dto';
import { OmitType } from '@nestjs/swagger';
import { IsIP } from 'class-validator';
import { QueryDto } from '../query.dto';

export class GetUrlMapDto extends QueryDto implements NestStorage.GetUrlMap {
  @ULIDField({ required: false })
  userId?: string;

  @StringField({ required: false })
  @IsIP()
  ip?: string;
}

export class GetUrlMapShortDto
  extends OmitType(GetUrlMapDto, ['userId'] as const)
  implements NestStorage.GetUrlMapShort {}
