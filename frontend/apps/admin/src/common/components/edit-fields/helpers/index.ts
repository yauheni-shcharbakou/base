import { ControllerProps } from 'react-hook-form';

export type EditFieldControllerProps = Omit<
  ControllerProps,
  'control' | 'name' | 'defaultValue' | 'render' | 'rules'
> & {
  rules?: Omit<ControllerProps['rules'], 'required'>;
};

export const combineControllerRules = (
  controllerProps?: EditFieldControllerProps,
  required?: boolean,
): Partial<ControllerProps> => {
  const rules: ControllerProps['rules'] = controllerProps?.rules ?? {};

  if (required) {
    rules.required = required;
  }

  return {
    ...(controllerProps ?? {}),
    rules,
  };
};
