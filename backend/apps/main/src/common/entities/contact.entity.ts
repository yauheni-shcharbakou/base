import { BooleanProp, MongoEntity, MongoSchema, StringProp } from '@backend/persistence';
import { SchemaFactory } from '@nestjs/mongoose';
import { MainDatabaseCollection } from '@packages/common';
import { Contact } from '@packages/grpc.nest';

@MongoSchema({ collection: MainDatabaseCollection.CONTACT })
export class ContactEntity extends MongoEntity implements Contact {
  @StringProp({ required: false })
  link?: string;

  @StringProp({ required: true, index: true, unique: true })
  name: string;

  @StringProp({ required: true })
  value: string;

  @BooleanProp({ required: true, default: false })
  isPublic: boolean;
}

export const ContactSchema = SchemaFactory.createForClass(ContactEntity);
