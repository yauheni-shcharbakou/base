import { ProviderIdEvent } from 'common/events/common.events';

export enum FileEventPattern {
  DELETE_ONE = 'file.delete.one',
}

export class FileDeleteOneEvent extends ProviderIdEvent {}
