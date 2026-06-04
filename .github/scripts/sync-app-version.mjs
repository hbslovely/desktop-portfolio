#!/usr/bin/env node
/**
 * Sync APP_VERSION in src/app/app-info.ts with package.json / release tag version.
 */
import fs from 'node:fs';
import path from 'node:path';

const version = process.argv[2];
if (!version) {
  console.error('Usage: sync-app-version.mjs <version>');
  process.exit(1);
}

const appInfoPath = path.join(process.cwd(), 'src/app/app-info.ts');
const source = fs.readFileSync(appInfoPath, 'utf8');
const next = source.replace(
  /export const APP_VERSION = '[^']*';/,
  `export const APP_VERSION = '${version}';`
);

if (next === source) {
  console.error(`Could not update APP_VERSION in ${appInfoPath}`);
  process.exit(1);
}

fs.writeFileSync(appInfoPath, next);
console.log(`Synced APP_VERSION to ${version} in src/app/app-info.ts`);
