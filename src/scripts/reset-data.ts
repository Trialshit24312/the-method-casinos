import 'dotenv/config';
import { initDatabase, resetCatalogToVerified } from '../database/index.js';

initDatabase();
const result = resetCatalogToVerified();

console.log('Catalog reset complete.');
console.log(`  Removed ${result.casinosRemoved} casino(s) (fake/unrelated entries cleared)`);
console.log(`  Removed ${result.blockedRemoved} blocked site(s)`);
console.log(`  Loaded ${result.casinosAdded} verified casino(s)`);
