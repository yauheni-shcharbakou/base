import { GrpcProxyMethodParams, GrpcProxyStreamMethodParams } from '@backend/grpc';
import { applyDecorators, Type } from '@nestjs/common';
import { ValidateGrpcPayload } from 'decorators/grpc.validate-payload.decorator';

type ParsedParams = {
  dto?: Type;
  decorators?: MethodDecorator[];
};

const parseParams = (params?: GrpcProxyMethodParams): ParsedParams => {
  if (!params) {
    return {};
  }

  if (typeof params === 'function') {
    return { dto: params };
  }

  if (typeof params === 'object') {
    let dto: Type | undefined;
    let decorators: MethodDecorator[] | undefined;

    if ('dto' in params) {
      dto = params.dto;
    }

    if ('decorators' in params && params.decorators.length) {
      decorators = params.decorators;
    }

    return { dto, decorators };
  }

  return {};
};

export const GrpcProxyMethod = (params?: GrpcProxyMethodParams): MethodDecorator => {
  const appliedDecorators: MethodDecorator[] = [];
  const parsedParams = parseParams(params);

  if (parsedParams.dto) {
    appliedDecorators.push(ValidateGrpcPayload(parsedParams.dto));
  }

  if (parsedParams.decorators) {
    appliedDecorators.push(...parsedParams.decorators);
  }

  return applyDecorators(...appliedDecorators);
};

export const GrpcProxyStreamMethod = (params?: GrpcProxyStreamMethodParams): MethodDecorator => {
  const appliedDecorators: MethodDecorator[] = [];
  const parsedParams = parseParams(params);

  if (parsedParams.decorators) {
    appliedDecorators.push(...parsedParams.decorators);
  }

  return applyDecorators(...appliedDecorators);
};
