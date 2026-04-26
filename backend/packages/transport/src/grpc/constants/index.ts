import { join } from 'node:path';
import { cwd } from 'node:process';

export const PROTO_PATH = join(cwd(), 'node_modules', '@packages', 'grpc', 'proto');
