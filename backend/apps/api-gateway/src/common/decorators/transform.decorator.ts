import { Transform } from 'class-transformer';
import _ from 'lodash';

export const TransformToDate = (): PropertyDecorator => {
  return Transform(({ value }) => {
    if (!value) {
      return value;
    }

    if (_.isString(value)) {
      return new Date(value);
    }

    if (_.isDate(value)) {
      return value;
    }

    return new Date(value.seconds * 1000 + value.nanos / 1e6);
  });
};

export const TransformToBoolean = (): PropertyDecorator => {
  return Transform(({ value }) => {
    if (_.isBoolean(value)) {
      return value;
    }

    if (_.isString(value)) {
      return value === 'true';
    }

    return value;
  });
};

export const TransformToArray = (): PropertyDecorator => {
  return Transform(({ value }) => {
    if (_.isArray(value)) {
      return value;
    }

    if (!_.isEmpty(value)) {
      return [value];
    }

    return value;
  });
};
