import { ApiProperty } from '@nestjs/swagger';
import { IdField } from '@backend/grpc';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class IdFieldDto implements IdField {
  @ApiProperty()
  @IsNotEmpty()
  @IsMongoId()
  id: string;
}
