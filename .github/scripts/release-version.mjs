#!/usr/bin/env node
/**
 * Version scheme:
 *   Monthly: YYYY.MM.1     (e.g. 2026.06.1)
 *   Daily:   YYYY.MM.N+1   (e.g. 2026.06.1 → 2026.06.2), strips -rc.NN
 *   Commit:  …-rc.NN — next number from max(package.json rc, existing v*-rc.* tags)
 */

import { execSync } from 'node:child_process';

const BASE_RE = /^(\d{4})\.(\d{2})\.(\d+)$/;
const RC_RE = /^(\d{4})\.(\d{2})\.(\d+)-rc\.(\d{2})$/;

export function monthlyVersion(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}.${m}.1`;
}

export function previousMonthlyTag(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `v${y}.${m}.1`;
}

export function bumpDaily(version) {
  const rc = RC_RE.exec(version);
  const base = rc ? `${rc[1]}.${rc[2]}.${rc[3]}` : version;
  const m = BASE_RE.exec(base);
  if (!m) {
    throw new Error(`Cannot bump daily from: ${version}`);
  }
  const patch = parseInt(m[3], 10) + 1;
  return `${m[1]}.${m[2]}.${patch}`;
}

export function parseBaseVersion(version) {
  const rc = RC_RE.exec(version);
  if (rc) return `${rc[1]}.${rc[2]}.${rc[3]}`;
  const base = BASE_RE.exec(version);
  if (base) return `${base[1]}.${base[2]}.${base[3]}`;
  return monthlyVersion();
}

export function listRcTagsForBase(base) {
  try {
    const out = execSync(`git tag -l "v${base}-rc.*"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/** Next -rc.NN: max(existing tags for base, rc in package.json) + 1 */
export function nextRcVersion(packageVersion) {
  const base = parseBaseVersion(packageVersion);
  let maxRc = 0;

  const inPkg = RC_RE.exec(packageVersion);
  if (inPkg) {
    maxRc = parseInt(inPkg[4], 10);
  }

  const prefix = `v${base}-rc.`;
  for (const tag of listRcTagsForBase(base)) {
    if (tag.startsWith(prefix)) {
      const n = parseInt(tag.slice(prefix.length), 10);
      if (!Number.isNaN(n)) {
        maxRc = Math.max(maxRc, n);
      }
    }
  }

  return `${base}-rc.${String(maxRc + 1).padStart(2, '0')}`;
}

/** @deprecated Use nextRcVersion — only bumps from package.json, ignores existing tags */
export function bumpRc(version) {
  return nextRcVersion(version);
}

const cmd = process.argv[2];
const arg = process.argv[3];

switch (cmd) {
  case 'monthly':
    console.log(monthlyVersion());
    break;
  case 'previous-monthly-tag':
    console.log(previousMonthlyTag());
    break;
  case 'daily':
    console.log(bumpDaily(arg ?? ''));
    break;
  case 'rc':
  case 'next-rc':
    console.log(nextRcVersion(arg ?? ''));
    break;
  default:
    console.error(
      'Usage: release-version.mjs <monthly|previous-monthly-tag|daily|next-rc> [version]'
    );
    process.exit(1);
}
