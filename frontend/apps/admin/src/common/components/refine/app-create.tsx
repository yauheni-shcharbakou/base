import { AppBreadcrumb } from '@/common/components';
import { Create, CreateProps } from '@refinedev/mui';
import { FC } from 'react';

type Props = Omit<CreateProps, 'breadcrumb'>;

export const AppCreate: FC<Props> = (props) => {
  return <Create breadcrumb={<AppBreadcrumb />} {...props} />;
};
