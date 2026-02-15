'use client';

import { StringEntityField } from '@/components/entity-fields';
import { RecordView } from '@/components/record-view';
import { useResourceShow } from '@/hooks/use-resource-show';
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
