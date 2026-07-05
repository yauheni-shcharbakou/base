'use client';

import { AppShow, RecordView, StringEntityField } from '@/common/components';
import { useResourceShow } from '@/common/hooks';
import type { BrowserAuth } from '@packages/proto';

export default function UserShow() {
  const { isLoading, record } = useResourceShow<BrowserAuth.User>();

  return (
    <AppShow isLoading={isLoading}>
      <RecordView record={record}>
        <StringEntityField label="Email" value={record?.email} />
        <StringEntityField label="Role" value={record?.role} />
      </RecordView>
    </AppShow>
  );
}
