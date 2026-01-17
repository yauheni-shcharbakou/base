import _ from 'lodash';
import Long from 'long';
import { isObjectIdOrHexString } from 'mongoose';
import { GrpcTimestamp } from 'types';

export class GrpcDataMapper {
  private static isTimestamp(obj: object): obj is GrpcTimestamp {
    if (_.keys(obj).length > 2) {
      return false;
    }

    if (!Long.isLong(obj['seconds']) && !_.isString(obj['seconds'])) {
      return false;
    }

    return !(obj['nanos'] && !_.isNumber(obj['nanos']) && !_.isString(obj['nanos']));
  }

  private static inTransformer<T = any>(value: T): T {
    if (!value) {
      return value;
    }

    if (isObjectIdOrHexString(value)) {
      return value.toString() as T;
    }

    if (_.isArray(value)) {
      return _.map(value, (item) => this.inTransformer(item)) as T;
    }

    if (_.isObject(value)) {
      if (this.isTimestamp(value)) {
        const seconds = BigInt(value.seconds.toString());
        const nanos = BigInt(value.nanos?.toString() ?? '0');

        return new Date(Number(seconds) * 1000 + Math.round(Number(nanos) / 1e6)) as T;
      }

      for (const field of _.keys(value)) {
        value[field] = this.inTransformer(value[field]);
      }

      return value;
    }

    return value;
  }

  private static outTransformer<T>(value: T): T {
    if (!value) {
      return value;
    }

    if (_.isDate(value)) {
      return {
        seconds: Long.fromInt(Math.round(value.getTime() / 1000)),
        nanos: (value.getTime() % 1000) * 1e6,
      } as T;
    }

    if (isObjectIdOrHexString(value)) {
      return value.toString() as T;
    }

    if (_.isArray(value)) {
      return _.map(value, (item) => this.outTransformer(item)) as T;
    }

    if (_.isObject(value)) {
      for (const field of _.keys(value)) {
        value[field] = this.outTransformer(value[field]);
      }

      return value;
    }

    return value;
  }

  /**
   * @description mapper for incoming grpc data
   */
  static get inTraffic() {
    return <T>(value: T): T => this.inTransformer(value);
  }

  /**
   * @description mapper for outcoming grpc data
   */
  static get outTraffic() {
    return <T>(value: T): T => this.outTransformer(value);
  }
}
