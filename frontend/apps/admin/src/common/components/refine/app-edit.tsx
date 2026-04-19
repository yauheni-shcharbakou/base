import { AppBreadcrumb } from '@/common/components';
import { Edit, EditProps } from '@refinedev/mui';
import { FC } from 'react';

type Props = Omit<EditProps, 'breadcrumb'>;

export const AppEdit: FC<Props> = (props) => {
  return <Edit breadcrumb={<AppBreadcrumb />} {...props} />;
};
