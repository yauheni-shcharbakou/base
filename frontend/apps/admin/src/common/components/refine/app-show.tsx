import { AppBreadcrumb } from '@/common/components';
import { Show, ShowProps } from '@refinedev/mui';
import { FC } from 'react';

type Props = Omit<ShowProps, 'breadcrumb'>;

export const AppShow: FC<Props> = (props) => {
  return <Show breadcrumb={<AppBreadcrumb />} {...props} />;
};
