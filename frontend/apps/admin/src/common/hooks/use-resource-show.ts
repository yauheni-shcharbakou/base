import { BaseRecord, useShow, UseShowProps } from '@refinedev/core';

export const useResourceShow = <Entity extends BaseRecord = BaseRecord>(
  props: UseShowProps<Entity> = {},
) => {
  const show = useShow<Entity>(props);
  const isLoading = show?.query?.isLoading;
  const record = show?.query?.data?.data;

  return {
    ...show,
    record,
    isLoading,
  };
};
