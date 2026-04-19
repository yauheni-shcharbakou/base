'use client';

import { AppShow, RecordView, StringEntityField } from '@/common/components';
import { useResourceShow } from '@/common/hooks';
import { GrpcUser } from '@packages/grpc';

export default function UserShow() {
  const { isLoading, record } = useResourceShow<GrpcUser>();

  return (
    <AppShow isLoading={isLoading}>
      <RecordView record={record}>
        <StringEntityField label="Email" value={record?.email} />
        <StringEntityField label="Role" value={record?.role} />
      </RecordView>
    </AppShow>
  );
}
