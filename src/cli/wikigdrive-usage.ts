import {usage} from './usage';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);

await usage(__filename);
process.exit(1);
