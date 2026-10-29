// npx tsx e2e/support/run.mts setup|cleanup
import { cleanup, setup } from './testData';
const what = process.argv[2];
console.log(what === 'setup' ? Object.keys(await setup()) : await cleanup());
process.exit(0);
