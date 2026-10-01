import { ObjectQuery } from '@mikro-orm/core';
import _ from 'lodash';

/** A media row that has a `storageObject` inverse relation and a backing `file`. */
interface PlaceableMedia {
  storageObject?: unknown;
}

/**
 * The `isPlaced` list filter shared by files, images and videos: whether a storage object places
 * the media. It reads the media's own column only (`file_id` / `image_id` / `video_id`), not a leaf
 * that references an image's or a video's backing file alone — no leaf does: `saveAndPlace*` writes
 * both references, and `validateMedia` refuses a leaf over a backing file. Placing still checks both
 * (`getMediaToPlace`). Anything but a boolean drops the filter.
 */
export const isPlacedFilter =
  <Doc extends PlaceableMedia>() =>
  (generated: unknown): ObjectQuery<Doc> | undefined =>
    _.isBoolean(generated)
      ? ({ storageObject: generated ? { $ne: null } : null } as ObjectQuery<Doc>)
      : undefined;

/** An image's or a video's upload status, which lives on its backing file row. */
export const backingFileStatusFilter =
  <Doc>() =>
  (generated: unknown): ObjectQuery<Doc> =>
    ({ file: { uploadStatus: generated } }) as ObjectQuery<Doc>;

/**
 * The `isBacking` list filter for files: whether the file backs an image or a video. Such a file is
 * placed through its image or video, never as a file of its own (`validateMedia`), so a file picker
 * asks for `isBacking: false`. Anything but a boolean drops the filter.
 */
export const isBackingFilter =
  <Doc>() =>
  (generated: unknown): ObjectQuery<Doc> | undefined => {
    if (!_.isBoolean(generated)) {
      return undefined;
    }

    return (
      generated
        ? { $or: [{ image: { $ne: null } }, { video: { $ne: null } }] }
        : { image: null, video: null }
    ) as ObjectQuery<Doc>;
  };
