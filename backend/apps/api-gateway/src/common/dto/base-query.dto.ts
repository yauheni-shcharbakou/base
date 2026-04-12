import { GrpcBaseQuery } from '@backend/grpc';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsOptional, IsString } from 'class-validator';
import { TransformToArray } from 'common/decorators/transform.decorator';

export class BaseQueryDto implements GrpcBaseQuery {
  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsString({ each: true })
  @TransformToArray()
  @ArrayMaxSize(100)
  ids: string[] = [];
}
