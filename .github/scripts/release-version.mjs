#!/usr/bin/env node
/**
 * Version scheme:
 *   Monthly: YYYY.MM.1     (e.g. 2026.06.1)
 *   Daily:   YYYY.MM.N+1   (e.g. 2026.06.1 → 2026.06.2), strips -rc.NN
 *   Commit:  …-rc.01 → …-rc.02 (e.g. 2026.06.1 → 2026.06.1-rc.01)
 */

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

export function bumpRc(version) {
  const rc = RC_RE.exec(version);
  if (rc) {
    const n = parseInt(rc[4], 10) + 1;
    return `${rc[1]}.${rc[2]}.${rc[3]}-rc.${String(n).padStart(2, '0')}`;
  }
  const base = BASE_RE.exec(version);
  if (base) {
    return `${base[1]}.${base[2]}.${base[3]}-rc.01`;
  }
  // e.g. 0.0.0 before first monthly release
  return `${monthlyVersion()}-rc.01`;
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
    console.log(bumpRc(arg ?? ''));
    break;
  default:
    console.error('Usage: release-version.mjs <monthly|previous-monthly-tag|daily|rc> [version]');
    process.exit(1);
}
