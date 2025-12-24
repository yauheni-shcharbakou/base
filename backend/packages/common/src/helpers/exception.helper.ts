import { HttpException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import _ from 'lodash';
import { of, OperatorFunction, pipe, switchMap, throwError } from 'rxjs';

export const getHttpExceptionResponseMessage = (exception: HttpException): string => {
  const response = exception.getResponse();

  if (_.isString(response)) {
    return response;
  }

  const message = response['message'];

  if (_.isArray(message)) {
    return message.join(', ');
  }

  return message ?? exception.message;
};

export const unwrapEither = <L, R>(): OperatorFunction<Either<L, R>, R> => {
  return pipe(
    switchMap((result) => (result.isLeft() ? throwError(() => result.value) : of(result.value))),
  );
};
