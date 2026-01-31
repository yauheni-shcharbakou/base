import { EntityWithTimestamps } from '@backend/grpc';
import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsOptional } from 'class-validator';
import { TransformToDate } from 'common/decorators/transform.decorator';
import { IdFieldDto } from 'common/dto/id-field.dto';

export class EntityWithTimestampsDto extends IdFieldDto implements EntityWithTimestamps {
  @ApiProperty({ type: Date })
  @IsNotEmpty()
  @IsDate()
  @TransformToDate()
  createdAt: Date;

  @ApiProperty({ type: Date, required: false })
  @IsOptional()
  @IsDate()
  @TransformToDate()
  updatedAt?: Date;
}
