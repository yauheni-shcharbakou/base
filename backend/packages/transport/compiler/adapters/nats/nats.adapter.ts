import { BaseAdapter } from '@compiler/adapters/base.adapter';
import { SourceFile } from 'ts-morph';

export class NatsAdapter extends BaseAdapter {
  protected compile(outputFile: SourceFile): void | Promise<void> {
    throw new Error('Method not implemented.');
  }
}
