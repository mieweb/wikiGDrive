import process from 'node:process';

import {usage} from './usage.ts';

const __filename = import.meta.filename;

await usage(__filename);
process.exit(1);
