import { Database } from '@packages/common';
import { IResourceComponents } from '@refinedev/core';

export class PathProvider {
  getListPath(database: Database, resource: string) {
    return `/${database}/${resource}`;
  }

  getCreatePath(database: Database, resource: string) {
    return `/${database}/${resource}/create`;
  }

  getCreateManyPath(database: Database, resource: string) {
    return `/${database}/${resource}/create-many`;
  }

  getShowPath(database: Database, resource: string, id: string) {
    return `/${database}/${resource}/${id}`;
  }

  private getShowPathPattern(database: Database, resource: string) {
    return `/${database}/${resource}/:id`;
  }

  getEditPath(database: Database, resource: string, id: string) {
    return `/${database}/${resource}/${id}/edit`;
  }

  private getEditPathPattern(database: Database, resource: string) {
    return `/${database}/${resource}/:id/edit`;
  }

  getResourcePages(
    database: Database,
    resource: string,
    enabledPages: (keyof IResourceComponents)[] = ['list', 'create', 'show', 'edit'],
  ): IResourceComponents {
    return enabledPages.reduce((acc: IResourceComponents, page) => {
      switch (page) {
        case 'list':
          acc.list = this.getListPath(database, resource);
          break;
        case 'create':
          acc.create = this.getCreatePath(database, resource);
          break;
        case 'show':
          acc.show = this.getShowPathPattern(database, resource);
          break;
        case 'edit':
          acc.edit = this.getEditPathPattern(database, resource);
          break;
        default:
          break;
      }

      return acc;
    }, {});
  }
}
