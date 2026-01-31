import { HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

const currentDate = new Date().toISOString();

const ApiMessages = (status: HttpStatus, ...messages: string[]) => {
  const examples = {};

  for (const message of messages) {
    examples[message] = {
      value: {
        statusCode: status,
        message,
        timestamp: currentDate,
        path: 'string',
      },
    };
  }

  if (!messages.length) {
    examples['Exception'] = {
      value: {
        statusCode: status,
        message: 'Exception',
        timestamp: currentDate,
        path: 'string',
      },
    };
  }

  return ApiResponse({
    status,
    content: {
      'application/json': {
        examples,
      },
    },
  });
};

export const ApiNotFoundMessages = (...messages: string[]) => {
  return ApiMessages(HttpStatus.NOT_FOUND, ...messages);
};

export const ApiBadRequestMessages = (...messages: string[]) => {
  return ApiMessages(HttpStatus.BAD_REQUEST, ...messages);
};
