'use client';

import { Control, Controller, ControllerProps, FieldValues } from 'react-hook-form';

export type EditFieldControllerProps = Omit<
  ControllerProps,
  'control' | 'defaultValue' | 'render' | 'rules' | 'name'
> & {
  rules?: Omit<ControllerProps['rules'], 'required'>;
};

type TypedControllerProps<V extends FieldValues = FieldValues, E = any, T = V> = Omit<
  ControllerProps,
  'control' | 'name' | 'rules'
> & {
  control?: Control<V, E, T>;
  fieldName: keyof V & string;
  required?: boolean;
  rules?: Omit<ControllerProps['rules'], 'required'>;
};

const combineControllerRules = (
  controllerProps: Omit<ControllerProps, 'control' | 'name'>,
  required?: boolean,
): Omit<ControllerProps, 'control' | 'name'> => {
  const rules: ControllerProps['rules'] = controllerProps.rules ?? {};

  if (required) {
    rules.required = required;
  }

  return { ...controllerProps, rules };
};

export const TypedController = <V extends FieldValues = FieldValues, E = any, T = V>({
  control,
  fieldName,
  required,
  ...props
}: TypedControllerProps<V, E, T>) => {
  return (
    <Controller
      control={control as Control}
      name={fieldName as string}
      {...combineControllerRules(props, required)}
    />
  );
};
