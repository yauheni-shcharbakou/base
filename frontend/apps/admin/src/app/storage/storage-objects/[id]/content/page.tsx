import { FolderBrowser } from '@/features/storage/components/folder-browser/folder-browser';
import {
  FOLDER_PREFERENCES_COOKIE,
  parseFolderPreferences,
} from '@/features/storage/helpers/folder-preferences';
import { cookies } from 'next/headers';
import React from 'react';

type Props = {
  params: Promise<{ id: string }>;
};

// A server component only to read the viewer's saved view and sort before the first render.
export default async function StorageObjectContent({ params }: Props) {
  const { id } = await params;
  const cookieStore = await cookies();
  const preferences = parseFolderPreferences(cookieStore.get(FOLDER_PREFERENCES_COOKIE)?.value);

  return <FolderBrowser folderId={id} preferences={preferences} />;
}
