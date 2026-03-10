import { IdField } from '@/common/components';
import { Checkbox, IconButton } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { Database } from '@packages/common';
import { BaseRecord } from '@refinedev/core';
import { DateField, DeleteButton, EditButton, ShowButton } from '@refinedev/mui';
import { capitalCase } from 'change-case-all';
import { ExternalIcon } from 'next/dist/client/components/react-dev-overlay/ui/icons/external';
import React from 'react';

type RefParams<Entity extends BaseRecord> = Partial<GridColDef<Entity>> & {
  database: Database;
  resource: string;
};

export class GridColumnsBuilder<Entity extends BaseRecord> {
  private readonly columns: GridColDef<Entity>[] = [];

  constructor() {
    this.id('id');
  }

  private getDefaultProps(
    field: keyof Entity | string,
    type: GridColDef<Entity>['type'],
  ): GridColDef<Entity> {
    const stringField = field.toString();

    return {
      field: stringField,
      headerName: capitalCase(stringField),
      width: 100,
      display: 'flex',
      flex: 1,
      type,
    };
  }

  id(field: keyof Entity, options: Partial<GridColDef<Entity>> = {}): this {
    this.columns.push({
      field: field.toString(),
      headerName: 'ID',
      type: 'string',
      width: 200,
      display: 'flex',
      align: 'left',
      headerAlign: 'left',
      filterable: false,
      renderCell: function render({ value }) {
        return <IdField value={value} />;
      },
      ...options,
    });

    return this;
  }

  string(field: keyof Entity, options: Partial<GridColDef<Entity>> = {}): this {
    this.columns.push({
      ...this.getDefaultProps(field, 'string'),
      ...options,
    });

    return this;
  }

  enum(field: keyof Entity, options: Partial<GridColDef<Entity>> = {}): this {
    this.columns.push({
      ...this.getDefaultProps(field, 'singleSelect'),
      align: 'center',
      headerAlign: 'center',
      ...options,
    });

    return this;
  }

  number(field: keyof Entity, options: Partial<GridColDef<Entity>> = {}): this {
    this.columns.push({
      ...this.getDefaultProps(field, 'number'),
      ...options,
    });

    return this;
  }

  date(field: keyof Entity, options: Partial<GridColDef<Entity>> = {}): this {
    this.columns.push({
      ...this.getDefaultProps(field, 'dateTime'),
      renderCell: function render({ value }) {
        return <DateField value={value} format="YYYY-MM-DDThh:mm:ssZ" />;
      },
      ...options,
    });

    return this;
  }

  boolean(field: keyof Entity, options: Partial<GridColDef<Entity>> = {}): this {
    this.columns.push({
      ...this.getDefaultProps(field, 'boolean'),
      width: 50,
      align: 'center',
      headerAlign: 'center',
      renderCell: function render({ value }) {
        return <Checkbox value={value} checked={value ?? false} disabled />;
      },
      ...options,
    });

    return this;
  }

  custom(field: keyof Entity, options: Partial<GridColDef<Entity>> = {}): this {
    this.columns.push({
      ...this.getDefaultProps(field, 'custom'),
      ...options,
    });

    return this;
  }

  ref(field: keyof Entity, { database, resource, ...options }: RefParams<Entity>): this {
    this.columns.push({
      ...this.getDefaultProps(field, 'singleSelect'),
      width: 50,
      align: 'center',
      headerAlign: 'center',
      flex: 0,
      renderCell: function render({ value }) {
        if (!value) {
          return <span></span>;
        }

        const id = typeof value === 'string' ? value : value.id;

        return (
          <IconButton
            href={`/${database}/${resource}/show/${id}`}
            children={<ExternalIcon />}
            color="primary"
          />
        );
      },
      ...options,
    });

    return this;
  }

  actions(options: Partial<Pick<GridColDef<Entity>, 'width' | 'renderCell'>> = {}): this {
    this.columns.push({
      field: 'actions',
      headerName: 'Actions',
      align: 'center',
      headerAlign: 'center',
      width: 120,
      sortable: false,
      filterable: false,
      display: 'flex',
      renderCell: function render({ row }) {
        return (
          <>
            <EditButton hideText recordItemId={row.id} />
            <ShowButton hideText recordItemId={row.id} />
            <DeleteButton hideText recordItemId={row.id} />
          </>
        );
      },
      ...options,
    });

    return this;
  }

  build(): GridColDef<Entity>[] {
    return this.columns;
  }
}
