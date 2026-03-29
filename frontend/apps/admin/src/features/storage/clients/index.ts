import { FileActionClient } from './file-action.client';
import { FolderActionClient } from './folder-action.client';
import { ImageActionClient } from './image-action.client';
import { VideoActionClient } from './video-action.client';

export const folderActionClient = new FolderActionClient();
export const fileActionClient = new FileActionClient();
export const imageActionClient = new ImageActionClient();
export const videoActionClient = new VideoActionClient();
