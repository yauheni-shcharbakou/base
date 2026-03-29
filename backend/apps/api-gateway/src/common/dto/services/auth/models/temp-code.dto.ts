import { ApiProperty } from '@nestjs/swagger';
import { GrpcTempCode } from '@backend/grpc';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsNotEmpty, IsString } from 'class-validator';
import { TransformToDate } from 'common/decorators/transform.decorator';
import { EntityWithTimestampsDto } from 'common/dto/entity-with-timestamps.dto';

export class TempCodeDto extends EntityWithTimestampsDto implements GrpcTempCode {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsBoolean()
  @Type(() => Boolean)
  isActive: boolean;

  @ApiProperty({ type: Date })
  @IsNotEmpty()
  @IsDate()
  @TransformToDate()
  expiredAt: Date;
}
