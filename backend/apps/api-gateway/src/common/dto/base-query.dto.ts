import { GrpcBaseQuery } from '@backend/grpc';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsMongoId, IsOptional, IsString } from 'class-validator';
import { TransformToArray } from 'common/decorators/transform.decorator';

export class BaseQueryDto implements GrpcBaseQuery {
  @ApiProperty({ type: String, required: false })
  @IsOptional()
  // @IsMongoId()
  @IsString()
  // @Type(() => String)
  id?: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsString({ each: true })
  @TransformToArray()
  ids: string[] = [];
}
