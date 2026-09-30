'use client';

import { ResourceListPage, RowActionButton } from '@/common/components';
import { GridColumnsBuilder } from '@/common/utils';
import { formatFileSize, getFolderContentPath } from '@/features/storage/helpers';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import { type GridColDef } from '@mui/x-data-grid';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import type { BrowserStorage } from '@packages/proto';
import React, { useMemo } from 'react';

export default function StorageObjectList() {
  const columns = useMemo<GridColDef<BrowserStorage.StorageObjectPopulated>[]>(
    () =>
      new GridColumnsBuilder<BrowserStorage.StorageObjectPopulated>()
        .ref('userId', {
          headerName: 'User',
          database: Database.AUTH,
          resource: AuthDatabaseEntity.USER,
        })
        .ref('file', {
          database: Database.STORAGE,
          resource: StorageDatabaseEntity.FILE,
        })
        .ref('image', {
          database: Database.STORAGE,
          resource: StorageDatabaseEntity.IMAGE,
        })
        .ref('video', {
          database: Database.STORAGE,
          resource: StorageDatabaseEntity.VIDEO,
        })
        .string('name', { valueGetter: (value) => value || 'Root Folder' })
        .enum('type', { maxWidth: 100 })
        // A leaf's own file, a folder's whole subtree. Neither sorts nor filters: a folder's is not a
        // column but a walk of its subtree, and a leaf's lives on another table.
        .string('folderStats', {
          headerName: 'Size',
          maxWidth: 120,
          sortable: false,
          filterable: false,
          valueGetter: (_value, row) =>
            formatFileSize(row.isFolder ? row.folderStats?.totalSize : row.file?.size),
        })
        .boolean('isPublic', { maxWidth: 100 })
        .date('createdAt')
        .actions({
          width: 176,
          prepend: (row) =>
            row.isFolder && (
              <RowActionButton title="Open folder" href={getFolderContentPath(row.id)}>
                <FolderOpenOutlined fontSize="small" />
              </RowActionButton>
            ),
        })
        .build(),
    [],
  );

  return <ResourceListPage resource={StorageDatabaseEntity.STORAGE_OBJECT} columns={columns} />;
}
