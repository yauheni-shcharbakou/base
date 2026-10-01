import { NestStorage } from '@backend/proto';
import { ULIDField } from '@common/application/decorators/field.decorator.dto';
import { OmitType } from '@nestjs/swagger';
import { QueryDto } from '../query.dto';

export class GetUrlMapDto extends QueryDto implements NestStorage.GetUrlMap {
  @ULIDField({ required: false })
  userId?: string;
}

export class GetUrlMapShortDto
  extends OmitType(GetUrlMapDto, ['userId'] as const)
  implements NestStorage.GetUrlMapShort {}
