import { BrowserStorage } from '@packages/proto';

/** What a folder view draws an item as: its icon, its colour and its label. */
export enum StorageItemKind {
  FOLDER = 'folder',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  PDF = 'pdf',
  DOCUMENT = 'document',
  SPREADSHEET = 'spreadsheet',
  PRESENTATION = 'presentation',
  ARCHIVE = 'archive',
  CODE = 'code',
  TEXT = 'text',
  OTHER = 'other',
}

export const STORAGE_ITEM_KIND_LABELS: Record<StorageItemKind, string> = {
  [StorageItemKind.FOLDER]: 'Folder',
  [StorageItemKind.IMAGE]: 'Image',
  [StorageItemKind.VIDEO]: 'Video',
  [StorageItemKind.AUDIO]: 'Audio',
  [StorageItemKind.PDF]: 'PDF',
  [StorageItemKind.DOCUMENT]: 'Document',
  [StorageItemKind.SPREADSHEET]: 'Spreadsheet',
  [StorageItemKind.PRESENTATION]: 'Presentation',
  [StorageItemKind.ARCHIVE]: 'Archive',
  [StorageItemKind.CODE]: 'Code',
  [StorageItemKind.TEXT]: 'Text',
  [StorageItemKind.OTHER]: 'File',
};

type KindSource = Pick<BrowserStorage.StorageObjectFolderItem, 'type'> & {
  file?: Pick<BrowserStorage.File, 'mimeType' | 'extension'>;
};

const KIND_BY_OBJECT_TYPE: Partial<Record<BrowserStorage.StorageObjectType, StorageItemKind>> = {
  [BrowserStorage.StorageObjectType.FOLDER]: StorageItemKind.FOLDER,
  [BrowserStorage.StorageObjectType.IMAGE]: StorageItemKind.IMAGE,
  [BrowserStorage.StorageObjectType.VIDEO]: StorageItemKind.VIDEO,
};

// Exact MIME types first: `application/*` says nothing on its own.
const KIND_BY_MIME_TYPE: Record<string, StorageItemKind> = {
  'application/pdf': StorageItemKind.PDF,
  'application/msword': StorageItemKind.DOCUMENT,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    StorageItemKind.DOCUMENT,
  'application/vnd.oasis.opendocument.text': StorageItemKind.DOCUMENT,
  'application/rtf': StorageItemKind.DOCUMENT,
  'application/vnd.ms-excel': StorageItemKind.SPREADSHEET,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': StorageItemKind.SPREADSHEET,
  'application/vnd.oasis.opendocument.spreadsheet': StorageItemKind.SPREADSHEET,
  'text/csv': StorageItemKind.SPREADSHEET,
  'application/vnd.ms-powerpoint': StorageItemKind.PRESENTATION,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    StorageItemKind.PRESENTATION,
  'application/vnd.oasis.opendocument.presentation': StorageItemKind.PRESENTATION,
  'application/zip': StorageItemKind.ARCHIVE,
  'application/x-zip-compressed': StorageItemKind.ARCHIVE,
  'application/x-rar-compressed': StorageItemKind.ARCHIVE,
  'application/vnd.rar': StorageItemKind.ARCHIVE,
  'application/x-7z-compressed': StorageItemKind.ARCHIVE,
  'application/x-tar': StorageItemKind.ARCHIVE,
  'application/gzip': StorageItemKind.ARCHIVE,
  'application/x-bzip2': StorageItemKind.ARCHIVE,
  'application/json': StorageItemKind.CODE,
  'application/xml': StorageItemKind.CODE,
  'application/javascript': StorageItemKind.CODE,
  'application/typescript': StorageItemKind.CODE,
  'application/x-sh': StorageItemKind.CODE,
  'application/yaml': StorageItemKind.CODE,
  'text/html': StorageItemKind.CODE,
  'text/css': StorageItemKind.CODE,
  'text/javascript': StorageItemKind.CODE,
  'text/xml': StorageItemKind.CODE,
};

const KIND_BY_MIME_GROUP: Record<string, StorageItemKind> = {
  image: StorageItemKind.IMAGE,
  video: StorageItemKind.VIDEO,
  audio: StorageItemKind.AUDIO,
  text: StorageItemKind.TEXT,
};

// The fallback for a file uploaded with an empty or generic MIME type.
const KIND_BY_EXTENSION: Record<string, StorageItemKind> = {
  pdf: StorageItemKind.PDF,
  doc: StorageItemKind.DOCUMENT,
  docx: StorageItemKind.DOCUMENT,
  odt: StorageItemKind.DOCUMENT,
  rtf: StorageItemKind.DOCUMENT,
  pages: StorageItemKind.DOCUMENT,
  xls: StorageItemKind.SPREADSHEET,
  xlsx: StorageItemKind.SPREADSHEET,
  ods: StorageItemKind.SPREADSHEET,
  csv: StorageItemKind.SPREADSHEET,
  numbers: StorageItemKind.SPREADSHEET,
  ppt: StorageItemKind.PRESENTATION,
  pptx: StorageItemKind.PRESENTATION,
  odp: StorageItemKind.PRESENTATION,
  key: StorageItemKind.PRESENTATION,
  zip: StorageItemKind.ARCHIVE,
  rar: StorageItemKind.ARCHIVE,
  '7z': StorageItemKind.ARCHIVE,
  tar: StorageItemKind.ARCHIVE,
  gz: StorageItemKind.ARCHIVE,
  tgz: StorageItemKind.ARCHIVE,
  bz2: StorageItemKind.ARCHIVE,
  json: StorageItemKind.CODE,
  xml: StorageItemKind.CODE,
  yml: StorageItemKind.CODE,
  yaml: StorageItemKind.CODE,
  html: StorageItemKind.CODE,
  css: StorageItemKind.CODE,
  js: StorageItemKind.CODE,
  jsx: StorageItemKind.CODE,
  ts: StorageItemKind.CODE,
  tsx: StorageItemKind.CODE,
  sh: StorageItemKind.CODE,
  py: StorageItemKind.CODE,
  sql: StorageItemKind.CODE,
  txt: StorageItemKind.TEXT,
  md: StorageItemKind.TEXT,
  log: StorageItemKind.TEXT,
  jpg: StorageItemKind.IMAGE,
  jpeg: StorageItemKind.IMAGE,
  png: StorageItemKind.IMAGE,
  gif: StorageItemKind.IMAGE,
  webp: StorageItemKind.IMAGE,
  svg: StorageItemKind.IMAGE,
  heic: StorageItemKind.IMAGE,
  mp4: StorageItemKind.VIDEO,
  mov: StorageItemKind.VIDEO,
  mkv: StorageItemKind.VIDEO,
  webm: StorageItemKind.VIDEO,
  avi: StorageItemKind.VIDEO,
  mp3: StorageItemKind.AUDIO,
  wav: StorageItemKind.AUDIO,
  flac: StorageItemKind.AUDIO,
  ogg: StorageItemKind.AUDIO,
  m4a: StorageItemKind.AUDIO,
  aac: StorageItemKind.AUDIO,
};

/**
 * The kind of a folder item: its storage type decides for a folder, an image and a video; a plain
 * file is told by its MIME type, then by its extension.
 */
export const getStorageItemKind = ({ type, file }: KindSource): StorageItemKind => {
  const byType = KIND_BY_OBJECT_TYPE[type];

  if (byType) {
    return byType;
  }

  const mimeType = file?.mimeType?.toLowerCase().split(';')[0].trim() ?? '';
  const byMimeType = KIND_BY_MIME_TYPE[mimeType] ?? KIND_BY_MIME_GROUP[mimeType.split('/')[0]];

  if (byMimeType) {
    return byMimeType;
  }

  const extension = file?.extension?.toLowerCase().replace(/^\./, '') ?? '';
  return KIND_BY_EXTENSION[extension] ?? StorageItemKind.OTHER;
};
