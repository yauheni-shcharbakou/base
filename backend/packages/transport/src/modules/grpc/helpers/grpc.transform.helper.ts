import _ from 'lodash';
import { isObjectIdOrHexString } from 'mongoose';

export const transformGrpcData = (value: any) => {
  if (!value) {
    return value;
  }

  if (_.isDate(value)) {
    return {
      seconds: value.getTime() / 1000,
      nanos: (value.getTime() % 1000) * 1e6,
    };
  }

  if (isObjectIdOrHexString(value)) {
    return value.toString();
  }

  if (_.isArray(value)) {
    return _.map(value, (item) => transformGrpcData(item));
  }

  if (_.isObject(value)) {
    for (const field of _.keys(value)) {
      value[field] = transformGrpcData(value[field]);
    }

    return value;
  }

  return value;
};
