import { PlopTypes } from '@turbo/gen';
import { compileGenerator } from './compile';

export default function generator(plop: PlopTypes.NodePlopAPI) {
  [compileGenerator].forEach((generator) => generator(plop));
}
