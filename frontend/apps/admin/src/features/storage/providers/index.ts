import { FileActionProvider } from './file-action.provider';
import { FolderActionProvider } from './folder-action.provider';
import { ImageActionProvider } from './image-action.provider';
import { VideoActionProvider } from './video-action.provider';

export const folderActionProvider = new FolderActionProvider();
export const fileActionProvider = new FileActionProvider();
export const imageActionProvider = new ImageActionProvider();
export const videoActionProvider = new VideoActionProvider();
