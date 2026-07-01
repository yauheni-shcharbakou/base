import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import _ from 'lodash';

@ValidatorConstraint({ async: false })
export class IsULIDConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    if (!_.isString(value)) {
      return false;
    }

    const ulidRegex = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i;
    return ulidRegex.test(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `Field ${args.property} should be ULID.`;
  }
}

export function IsULID(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsULIDConstraint,
    });
  };
}
