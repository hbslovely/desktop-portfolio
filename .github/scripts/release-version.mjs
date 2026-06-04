#!/usr/bin/env node
/**
 * Version scheme:
 *   Monthly: YYYY.MM           (e.g. 2026.06) — tag v2026.06
 *   Daily:   YYYY.MM.N         (e.g. 2026.06 → 2026.06.1 → 2026.06.2), strips -rc.NN
 *   Commit:  <base>-rc.NN      (e.g. 2026.06-rc.01, 2026.06.1-rc.02)
 */

import { execSync } from 'node:child_process';

const MONTHLY_RE = /^(\d{4})\.(\d{2})$/;
const PATCH_RE = /^(\d{4})\.(\d{2})\.(\d+)$/;
const RC_SUFFIX_RE = /^(.+)-rc\.(\d{2})$/;

export function monthlyVersion(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}.${m}`;
}

export function previousMonthlyTag(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `v${y}.${m}`;
}

export function stripRcSuffix(version) {
  const match = RC_SUFFIX_RE.exec(version);
  return match ? match[1] : version;
}

export function parseBaseVersion(version) {
  const withoutRc = stripRcSuffix(version);
  if (MONTHLY_RE.test(withoutRc) || PATCH_RE.test(withoutRc)) {
    return withoutRc;
  }
  return monthlyVersion();
}

export function bumpDaily(version) {
  const base = stripRcSuffix(version);

  const monthly = MONTHLY_RE.exec(base);
  if (monthly) {
    return `${monthly[1]}.${monthly[2]}.1`;
  }

  const patch = PATCH_RE.exec(base);
  if (patch) {
    const next = parseInt(patch[3], 10) + 1;
    return `${patch[1]}.${patch[2]}.${next}`;
  }

  throw new Error(`Cannot bump daily from: ${version}`);
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

  const inPkg = RC_SUFFIX_RE.exec(packageVersion);
  if (inPkg) {
    maxRc = parseInt(inPkg[2], 10);
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

/** @deprecated Use nextRcVersion */
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
