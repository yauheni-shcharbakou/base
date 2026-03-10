import { GrpcVideo, GrpcVideoMetadata } from '@backend/grpc';
import { ApiProperty, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { EntityWithTimestampsDto } from 'common/dto/entity-with-timestamps.dto';

export class VideoDto extends EntityWithTimestampsDto implements GrpcVideo {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  duration: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  views: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  fileId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  providerId: string;
}

export class VideoMetadataDto
  extends PickType(VideoDto, ['title', 'description'] as const)
  implements GrpcVideoMetadata {}
