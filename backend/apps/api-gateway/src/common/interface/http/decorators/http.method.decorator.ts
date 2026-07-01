import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiOperationOptions,
  ApiResponse,
  ApiResponseMetadata,
} from '@nestjs/swagger';

type Options = Partial<
  Pick<ApiOperationOptions, 'deprecated' | 'tags' | 'description' | 'summary'> &
    Pick<ApiResponseMetadata, 'type' | 'isArray' | 'status'>
>;

export const Method = ({ deprecated, tags, description, summary, ...rest }: Options) => {
  return applyDecorators(
    ApiOperation({ deprecated, tags, description, summary }),
    ApiResponse(rest),
  );
};
