import {
  BooleanProp,
  MongoEntity,
  MongoSchema,
  NumberProp,
  ObjectIdProp,
  StringProp,
} from '@backend/persistence';
import { SchemaFactory } from '@nestjs/mongoose';
import { FileDatabaseCollection } from '@packages/common';
import { GrpcFile } from '@backend/grpc';

@MongoSchema({ collection: FileDatabaseCollection.FILE })
export class FileEntity extends MongoEntity implements GrpcFile {
  @ObjectIdProp({ required: true, index: true })
  user: string;

  @StringProp({ required: true, index: true })
  name: string;

  @StringProp({ required: true })
  originalName: string;

  @NumberProp({ required: true })
  size: number;

  @StringProp({ required: true, index: true })
  mimeType: string;

  @BooleanProp({ required: false, index: true, default: () => false })
  isPublic: boolean;
}

export const FileSchema = SchemaFactory.createForClass(FileEntity);
