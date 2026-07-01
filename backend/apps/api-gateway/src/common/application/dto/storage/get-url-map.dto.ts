import { NestStorage } from '@backend/proto';
import { StringField, ULIDField } from '@common/application/decorators/field.decorator.dto';
import { OmitType } from '@nestjs/swagger';
import { IsIP } from 'class-validator';
import { QueryDto } from '../query.dto';

export class GetUrlMapDto extends QueryDto implements NestStorage.GetUrlMap {
  @ULIDField()
  userId: string;

  @StringField({ required: false })
  @IsIP()
  ip?: string;
}

export class GetUrlMapWebDto
  extends OmitType(GetUrlMapDto, ['userId'] as const)
  implements NestStorage.GetUrlMapWeb {}
