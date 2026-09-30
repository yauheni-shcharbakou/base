import { NestStorage } from '@backend/proto';
import { StringField, ULIDField } from '@common/application/decorators/field.decorator.dto';
import { ArrayMaxSize, ArrayMinSize, IsNotEmpty, Matches } from 'class-validator';

// An uploaded directory's folders: past this, the admin refuses the drop before calling.
const MAX_TREE_FOLDERS = 500;
// Levels below the target. `folderPath` and the ancestor walks stop at 64 from the root.
const MAX_TREE_DEPTH = 32;

// Segments by the rule of `IsStorageObjectName`: none empty, none holding "/".
const FOLDER_PATH = new RegExp(`^[^/]+(?:/[^/]+){0,${MAX_TREE_DEPTH - 1}}$`);

export class StorageObjectCreateFoldersDto implements NestStorage.StorageObjectCreateFolders {
  @ULIDField()
  userId: string;

  @ULIDField()
  @IsNotEmpty()
  parent: string;

  @StringField({ isArray: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TREE_FOLDERS)
  @Matches(FOLDER_PATH, {
    each: true,
    message: `each value in $property must be a "/"-separated path of up to ${MAX_TREE_DEPTH} non-empty names`,
  })
  paths: string[];
}
