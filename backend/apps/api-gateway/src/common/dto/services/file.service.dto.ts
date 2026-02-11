import {
  GrpcFileCreate,
  GrpcFileQuery,
  GrpcFileRequest,
  GrpcFileUpdate,
  GrpcFileUpdateByIdRequest,
  GrpcFileUpdateRequest,
} from '@backend/grpc';
import { GrpcFile } from '@frontend/grpc';
import { ApiProperty, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { TransformToBoolean } from 'common/decorators/transform.decorator';
import { BaseQueryDto } from 'common/dto/base-query.dto';
import { EntityWithTimestampsDto } from 'common/dto/entity-with-timestamps.dto';
import {
  RequestDto,
  UpdateByIdRequestDto,
  UpdateDto,
  UpdateRequestDto,
} from 'common/dto/grpc-types.dto';

export class FileDto extends EntityWithTimestampsDto implements GrpcFile {
  @ApiProperty()
  @IsNotEmpty()
  @IsBoolean()
  @TransformToBoolean()
  isPublic: boolean;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  mimeType: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  originalName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  size: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsMongoId()
  @Type(() => String)
  user: string;
}

export class FileQueryDto extends BaseQueryDto implements GrpcFileQuery {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @TransformToBoolean()
  isPublic?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsString({ each: true })
  mimeTypes: string[] = [];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  @Type(() => String)
  user?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsMongoId({ each: true })
  @Type(() => String)
  users: string[] = [];
}

export class FileRequestDto extends RequestDto(FileQueryDto) implements GrpcFileRequest {}

export class FileCreateDto
  extends PickType(FileDto, [
    'name',
    'originalName',
    'user',
    'isPublic',
    'size',
    'mimeType',
  ] as const)
  implements GrpcFileCreate {}

export class FileUpdateDto extends UpdateDto(FileDto) implements GrpcFileUpdate {}

export class FileUpdateRequestDto
  extends UpdateRequestDto(FileQueryDto, FileUpdateDto)
  implements GrpcFileUpdateRequest {}

export class FileUpdateByIdRequestDto
  extends UpdateByIdRequestDto(FileUpdateDto)
  implements GrpcFileUpdateByIdRequest {}
