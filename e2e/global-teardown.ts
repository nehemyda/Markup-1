import { cleanup } from './support/testData';

export default async function globalTeardown() {
  if (process.env.E2E_KEEP) return console.log('E2E_KEEP is set: test accounts and data were kept.');
  console.log('Removed test data:', await cleanup());
}
