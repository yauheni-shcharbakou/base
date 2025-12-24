import { ApiProperty } from '@nestjs/swagger';
import { Contact, ContactList, ContactQuery, ContactRequest } from '@packages/grpc.nest';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { TransformToBoolean } from 'decorators';
import { BaseQueryDto } from 'dto/base-query.dto';
import { DatabaseEntityDto } from 'dto/database-entity.dto';
import { ListResponseDto } from 'dto/list-response.dto';

export class ContactDto extends DatabaseEntityDto implements Contact {
  @ApiProperty({ type: Boolean })
  @IsNotEmpty()
  @IsBoolean()
  @Type(() => Boolean)
  isPublic: boolean;

  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  link?: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  value: string;
}

export class ContactQueryDto extends BaseQueryDto implements ContactQuery {
  @ApiProperty({ type: Boolean, required: false })
  @IsOptional()
  @IsBoolean()
  @TransformToBoolean()
  isPublic?: boolean;

  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  name?: string;
}

export class ContactRequestDto implements ContactRequest {
  @ApiProperty({ type: ContactQueryDto, required: false })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ContactQueryDto)
  query?: ContactQueryDto;
}

export class ContactListDto extends ListResponseDto(ContactDto) implements ContactList {}
