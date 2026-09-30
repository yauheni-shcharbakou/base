import { ONE_GB_BYTES, ONE_MB_BYTES } from '@/common/constants';
import { BrowserStorage } from '@packages/proto';

const { FILE, IMAGE, VIDEO } = BrowserStorage.StorageObjectType;

/** What an upload becomes: a plain file, an image, or a video. */
export type UploadKind = typeof FILE | typeof IMAGE | typeof VIDEO;

type UploadRule = {
  maxSize: number;
  // The MIME types an upload of this kind takes. None: any type.
  mimeTypes?: string[];
};

/**
 * What each kind of upload takes, shared by its forms and the folder browser's drop. The backend
 * checks neither, so these are the one place the limits live.
 */
export const UPLOAD_RULES: Record<UploadKind, UploadRule> = {
  [IMAGE]: {
    maxSize: 100 * ONE_MB_BYTES,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
  },
  [VIDEO]: {
    maxSize: 2 * ONE_GB_BYTES,
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
  },
  [FILE]: { maxSize: 100 * ONE_MB_BYTES },
};

/** A rule's MIME types as a dropzone's `accept`. */
export const toDropzoneAccept = (mimeTypes: string[] = []): Record<string, string[]> =>
  Object.fromEntries(mimeTypes.map((type) => [type, []]));

/**
 * The kind a file is uploaded as, the way Drive sorts a drop: an image or a video its form takes
 * becomes one, and anything else — a HEIC photo, an MKV — is kept as a plain file.
 */
export const getUploadKind = ({ type }: Pick<File, 'type'>): UploadKind => {
  const mimeType = type.toLowerCase();

  if (UPLOAD_RULES[IMAGE].mimeTypes?.includes(mimeType)) {
    return IMAGE;
  }

  return UPLOAD_RULES[VIDEO].mimeTypes?.includes(mimeType) ? VIDEO : FILE;
};

export type SortedUploads = {
  accepted: { file: File; kind: UploadKind }[];
  // Each refused file's name, with why.
  rejected: { name: string; reason: string }[];
};

const formatLimit = (bytes: number) =>
  bytes >= ONE_GB_BYTES ? `${bytes / ONE_GB_BYTES} GB` : `${bytes / ONE_MB_BYTES} MB`;

/** Splits dropped files into what can be uploaded and what cannot: empty, or over its limit. */
export const sortUploads = (files: File[]): SortedUploads => {
  const sorted: SortedUploads = { accepted: [], rejected: [] };

  files.forEach((file) => {
    const kind = getUploadKind(file);
    const { maxSize } = UPLOAD_RULES[kind];

    if (!file.size) {
      sorted.rejected.push({ name: file.name, reason: 'empty' });
    } else if (file.size > maxSize) {
      sorted.rejected.push({ name: file.name, reason: `over ${formatLimit(maxSize)}` });
    } else {
      sorted.accepted.push({ file, kind });
    }
  });

  return sorted;
};

/** A drag that carries files from outside the page — the desktop, a file manager. */
export const isFileDrag = (types: readonly string[]) => types.includes('Files');
