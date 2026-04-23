import { join } from 'path';
import { cwd } from 'process';

export const PROTO_PATH = join(cwd(), 'node_modules', '@packages', 'grpc', 'proto');
