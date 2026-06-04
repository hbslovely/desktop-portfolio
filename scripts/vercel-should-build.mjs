#!/usr/bin/env node
/**
 * Vercel "Ignored Build Step" script.
 *
 * Exit 0 → skip deployment
 * Exit 1 → run deployment
 *
 * Deploys only when package.json "version" changed vs the previous commit.
 * Works with .github/workflows/commit-tags.yml (RC bump → deploy).
 *
 * Overrides:
 *   VERCEL_FORCE_BUILD=1  — always deploy
 *   [deploy] in commit message — always deploy
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readPackageVersion(fromRef = 'HEAD') {
  if (fromRef === 'HEAD') {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  }

  const raw = execSync(`git show ${fromRef}:package.json`, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(raw).version;
}

function hasPreviousCommit() {
  try {
    execSync('git rev-parse HEAD~1', { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function shouldForceBuild() {
  if (process.env.VERCEL_FORCE_BUILD === '1') {
    console.log('VERCEL_FORCE_BUILD=1 — deployment allowed.');
    return true;
  }

  const message = process.env.VERCEL_GIT_COMMIT_MESSAGE ?? '';
  if (message.includes('[deploy]')) {
    console.log('[deploy] in commit message — deployment allowed.');
    return true;
  }

  return false;
}

function allowBuild() {
  console.log('Deployment allowed.');
  process.exit(1);
}

function skipBuild(reason) {
  console.log(`${reason} — skipping deployment.`);
  process.exit(0);
}

if (shouldForceBuild()) {
  allowBuild();
}

const current = readPackageVersion('HEAD');

if (!hasPreviousCommit()) {
  allowBuild();
}

let previous;
try {
  previous = readPackageVersion('HEAD~1');
} catch {
  console.log('Could not read previous package.json — deployment allowed.');
  allowBuild();
}

if (current !== previous) {
  console.log(`Version changed: ${previous} → ${current}`);
  allowBuild();
}

skipBuild(`Version unchanged (${current})`);
