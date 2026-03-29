import { GrpcImage, GrpcImageCreate } from '@backend/grpc';
import { ApiProperty, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { EntityWithTimestampsDto } from 'common/dto/entity-with-timestamps.dto';

export class ImageDto extends EntityWithTimestampsDto implements GrpcImage {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  width: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  height: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  alt: string;

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
  uploadId: string;
}

export class ImageCreateDto
  extends PickType(ImageDto, ['width', 'height', 'alt'] as const)
  implements GrpcImageCreate {}
