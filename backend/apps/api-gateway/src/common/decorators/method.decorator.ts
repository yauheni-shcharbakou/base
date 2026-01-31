import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiResponseMetadata } from '@nestjs/swagger/dist/decorators/api-response.decorator';
import { OperationObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

type Options = Partial<
  Pick<OperationObject, 'deprecated' | 'tags' | 'description' | 'summary'> &
    Pick<ApiResponseMetadata, 'type' | 'isArray' | 'status'>
>;

export const Method = ({ deprecated, tags, description, summary, ...rest }: Options) => {
  return applyDecorators(
    ApiOperation({ deprecated, tags, description, summary }),
    ApiResponse(rest),
  );
};
