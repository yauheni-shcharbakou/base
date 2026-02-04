import { PlopTypes } from '@turbo/gen';
import { packageGenerator } from './package';

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  [packageGenerator].forEach((generator) => generator(plop));
}
