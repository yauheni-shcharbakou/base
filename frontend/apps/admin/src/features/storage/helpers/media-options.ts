import { StorageDatabaseEntity } from '@packages/common';
import { BrowserStorage } from '@packages/proto';
import type { CrudFilter } from '@refinedev/core';

export type LeafType = Exclude<
  BrowserStorage.StorageObjectType,
  BrowserStorage.StorageObjectType.FOLDER
>;

export type MediaField = 'file' | 'image' | 'video';

export type MediaRecord =
  BrowserStorage.File | BrowserStorage.ImagePopulated | BrowserStorage.VideoPopulated;

export interface MediaOption {
  label: string;
  value: string;
}

// A Record, so the compiler demands every leaf type: the resource a type's media is listed from,
// the `StorageObjectCreate` field its id is sent in, and what a person calls it.
export const MEDIA_BY_TYPE: Record<
  LeafType,
  { resource: StorageDatabaseEntity; field: MediaField; label: string }
> = {
  [BrowserStorage.StorageObjectType.FILE]: {
    resource: StorageDatabaseEntity.FILE,
    field: 'file',
    label: 'File',
  },
  [BrowserStorage.StorageObjectType.IMAGE]: {
    resource: StorageDatabaseEntity.IMAGE,
    field: 'image',
    label: 'Image',
  },
  [BrowserStorage.StorageObjectType.VIDEO]: {
    resource: StorageDatabaseEntity.VIDEO,
    field: 'video',
    label: 'Video',
  },
};

export const isLeafType = (type?: BrowserStorage.StorageObjectType): type is LeafType =>
  !!type && type !== BrowserStorage.StorageObjectType.FOLDER;

/**
 * What the backend accepts for a new leaf: the owner's media that nothing places yet and whose
 * upload is READY. A file must not back an image or a video either — that one is placed through its
 * image or video. `isPlaced` and `isBacking` are list filters of the storage service, not fields of
 * the records.
 */
export const placeableMediaFilters = (type: LeafType, userId: string): CrudFilter[] => [
  { field: 'userId', operator: 'eq', value: userId },
  { field: 'isPlaced', operator: 'eq', value: false },
  { field: 'uploadStatus', operator: 'eq', value: BrowserStorage.FileUploadStatus.READY },
  ...(type === BrowserStorage.StorageObjectType.FILE
    ? [{ field: 'isBacking', operator: 'eq', value: false } as CrudFilter]
    : []),
];

const imageLabel = (image: BrowserStorage.ImagePopulated): string => {
  const name = image.file?.originalName || image.alt || image.id;
  return `${name} (${image.width}×${image.height})`;
};

/** A picker option: the name a person recognises the media by, and its id. */
export const mediaOption = (type: LeafType, record: MediaRecord): MediaOption => {
  switch (type) {
    case BrowserStorage.StorageObjectType.FILE:
      return {
        label: (record as BrowserStorage.File).originalName || record.id,
        value: record.id,
      };
    case BrowserStorage.StorageObjectType.IMAGE:
      return { label: imageLabel(record as BrowserStorage.ImagePopulated), value: record.id };
    case BrowserStorage.StorageObjectType.VIDEO: {
      const video = record as BrowserStorage.VideoPopulated;
      return { label: video.title || video.file?.originalName || video.id, value: video.id };
    }
  }
};
