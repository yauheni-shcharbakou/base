'use client';

import { RecordView, StringEntityField } from '@/common/components';
import { useResourceShow } from '@/common/hooks';
import { GrpcUser } from '@packages/grpc';
import { Show } from '@refinedev/mui';

export default function UserShow() {
  const { isLoading, record } = useResourceShow<GrpcUser>();

  return (
    <Show isLoading={isLoading}>
      <RecordView record={record}>
        <StringEntityField label="Email" value={record?.email} />
        <StringEntityField label="Role" value={record?.role} />
      </RecordView>
    </Show>
  );
}
