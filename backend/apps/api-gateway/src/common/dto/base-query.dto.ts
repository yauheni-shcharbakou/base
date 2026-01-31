import { BaseQuery } from '@backend/grpc';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsMongoId, IsOptional } from 'class-validator';
import { TransformToArray } from 'common/decorators/transform.decorator';

export class BaseQueryDto implements BaseQuery {
  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsMongoId()
  @Type(() => String)
  id?: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsMongoId({ each: true })
  @TransformToArray()
  ids: string[] = [];
}
