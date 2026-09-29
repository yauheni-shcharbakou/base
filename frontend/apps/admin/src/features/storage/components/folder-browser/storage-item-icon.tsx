'use client';

import { StorageItemKind } from '@/features/storage/helpers';
import ArticleOutlined from '@mui/icons-material/ArticleOutlined';
import AudioFileOutlined from '@mui/icons-material/AudioFileOutlined';
import CodeOutlined from '@mui/icons-material/CodeOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import Folder from '@mui/icons-material/Folder';
import FolderZipOutlined from '@mui/icons-material/FolderZipOutlined';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import MovieOutlined from '@mui/icons-material/MovieOutlined';
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined';
import SlideshowOutlined from '@mui/icons-material/SlideshowOutlined';
import TableChartOutlined from '@mui/icons-material/TableChartOutlined';
import type { SvgIconProps } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import React, { FC } from 'react';

// Google Drive's colours for what it has a colour for; the theme's secondary text for the rest,
// so they read in both colour modes.
const ICON_BY_KIND: Record<StorageItemKind, { Icon: SvgIconComponent; color: string }> = {
  [StorageItemKind.FOLDER]: { Icon: Folder, color: 'text.secondary' },
  [StorageItemKind.IMAGE]: { Icon: ImageOutlined, color: '#ea4335' },
  [StorageItemKind.VIDEO]: { Icon: MovieOutlined, color: '#ea4335' },
  [StorageItemKind.AUDIO]: { Icon: AudioFileOutlined, color: '#a142f4' },
  [StorageItemKind.PDF]: { Icon: PictureAsPdfOutlined, color: '#ea4335' },
  [StorageItemKind.DOCUMENT]: { Icon: DescriptionOutlined, color: '#4285f4' },
  [StorageItemKind.SPREADSHEET]: { Icon: TableChartOutlined, color: '#0f9d58' },
  [StorageItemKind.PRESENTATION]: { Icon: SlideshowOutlined, color: '#f4b400' },
  [StorageItemKind.ARCHIVE]: { Icon: FolderZipOutlined, color: 'text.secondary' },
  [StorageItemKind.CODE]: { Icon: CodeOutlined, color: 'text.secondary' },
  [StorageItemKind.TEXT]: { Icon: ArticleOutlined, color: '#4285f4' },
  [StorageItemKind.OTHER]: { Icon: InsertDriveFileOutlined, color: 'text.secondary' },
};

type Props = SvgIconProps & {
  kind: StorageItemKind;
};

export const StorageItemIcon: FC<Props> = ({ kind, sx, ...props }) => {
  const { Icon, color } = ICON_BY_KIND[kind];
  return <Icon sx={{ color, ...sx }} {...props} />;
};
