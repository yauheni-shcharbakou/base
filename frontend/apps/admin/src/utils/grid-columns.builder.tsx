import { Checkbox } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { BaseRecord } from '@refinedev/core';
import { DateField, DeleteButton, EditButton, ShowButton } from '@refinedev/mui';
import { capitalCase } from 'change-case-all';
import React from 'react';

export class GridColumnsBuilder<Entity extends BaseRecord> {
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

  private readonly columns: GridColDef<Entity>[] = [
    {
      field: 'id',
      headerName: 'ID',
      type: 'string',
      width: 200,
      display: 'flex',
      align: 'left',
      headerAlign: 'left',
      filterable: false,
    },
  ];

  string(field: keyof Entity | string, options: Partial<GridColDef<Entity>> = {}): this {
    this.columns.push({
      ...this.getDefaultProps(field, 'string'),
      ...options,
    });

    return this;
  }

  enum(field: keyof Entity | string, options: Partial<GridColDef<Entity>> = {}): this {
    this.columns.push({
      ...this.getDefaultProps(field, 'singleSelect'),
      ...options,
    });

    return this;
  }

  number(field: keyof Entity | string, options: Partial<GridColDef<Entity>> = {}): this {
    this.columns.push({
      ...this.getDefaultProps(field, 'number'),
      ...options,
    });

    return this;
  }

  date(field: keyof Entity | string, options: Partial<GridColDef<Entity>> = {}): this {
    this.columns.push({
      ...this.getDefaultProps(field, 'dateTime'),
      renderCell: function render({ value }) {
        return <DateField value={value} format="YYYY-MM-DDThh:mm:ssZ" />;
      },
      ...options,
    });

    return this;
  }

  boolean(field: keyof Entity | string, options: Partial<GridColDef<Entity>> = {}): this {
    this.columns.push({
      ...this.getDefaultProps(field, 'boolean'),
      width: 50,
      renderCell: function render({ value }) {
        return <Checkbox value={value} checked={value ?? false} disabled />;
      },
      ...options,
    });

    return this;
  }

  custom(field: keyof Entity | string, options: Partial<GridColDef<Entity>> = {}): this {
    this.columns.push({
      ...this.getDefaultProps(field, 'custom'),
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
