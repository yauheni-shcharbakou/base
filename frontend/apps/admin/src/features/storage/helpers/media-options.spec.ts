import { BrowserStorage } from '@packages/proto';
import { isLeafType, mediaOption, placeableMediaFilters } from './media-options';

const { FILE, IMAGE, VIDEO, FOLDER } = BrowserStorage.StorageObjectType;

describe('placeableMediaFilters', () => {
  it('asks for the owner’s unplaced READY media', () => {
    expect(placeableMediaFilters(IMAGE, 'owner')).toEqual([
      { field: 'userId', operator: 'eq', value: 'owner' },
      { field: 'isPlaced', operator: 'eq', value: false },
      { field: 'uploadStatus', operator: 'eq', value: BrowserStorage.FileUploadStatus.READY },
    ]);
  });

  // A file behind an image or a video is placed through that media; the backend refuses it.
  it('leaves out a file backing other media, for files only', () => {
    const isBacking = { field: 'isBacking', operator: 'eq', value: false };

    expect(placeableMediaFilters(FILE, 'owner')).toContainEqual(isBacking);
    expect(placeableMediaFilters(VIDEO, 'owner')).not.toContainEqual(isBacking);
  });
});

describe('mediaOption', () => {
  const file = { id: 'file-1', originalName: 'report.pdf' } as BrowserStorage.File;

  it('names a file by its original name', () => {
    expect(mediaOption(FILE, file)).toEqual({ label: 'report.pdf', value: 'file-1' });
  });

  it('names an image by its file, then its alt, with its size', () => {
    const image = {
      id: 'image-1',
      alt: 'A cat',
      width: 640,
      height: 480,
      file,
    } as BrowserStorage.ImagePopulated;

    expect(mediaOption(IMAGE, image).label).toBe('report.pdf (640×480)');
    expect(mediaOption(IMAGE, { ...image, file: { ...file, originalName: '' } }).label).toBe(
      'A cat (640×480)',
    );
  });

  it('names a video by its title, then its file', () => {
    const video = { id: 'video-1', title: '', file } as BrowserStorage.VideoPopulated;

    expect(mediaOption(VIDEO, video)).toEqual({ label: 'report.pdf', value: 'video-1' });
    expect(mediaOption(VIDEO, { ...video, title: 'Intro' }).label).toBe('Intro');
  });
});

describe('isLeafType', () => {
  it('is true for media types only', () => {
    expect(isLeafType(FILE)).toBe(true);
    expect(isLeafType(FOLDER)).toBe(false);
    expect(isLeafType(undefined)).toBe(false);
  });
});
