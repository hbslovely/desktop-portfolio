import type { FeedingLog, FeedingSettingsResolved } from '../../services/feeding-log.service';
import type { FeedingViewGroup } from './feeding-view-group';

export function logTimestamp(l: FeedingLog): number {
  const [y, m, d] = (l.date || '').split('-').map(Number);
  const [hh, mm] = (l.time || '').split(':').map(Number);
  if (!y || !m || !d || isNaN(hh) || isNaN(mm)) return 0;
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

export function logRowKey(l: FeedingLog): string {
  return l.rowIndex != null ? `r${l.rowIndex}` : `${l.date}|${l.time}`;
}

export function viewGroupKey(g: FeedingViewGroup): string {
  return g.members.map((m) => logRowKey(m)).join('>');
}

export function isLowVolume(volume: number, settings: FeedingSettingsResolved): boolean {
  const max = settings.feedWarningMl;
  return volume > 0 && volume < max;
}

export function isHighVolume(volume: number): boolean {
  return volume > 200;
}

export function viewGroupDisplayVolume(g: FeedingViewGroup): number {
  return g.members.reduce((s, m) => s + (m.volume || 0), 0);
}

export function viewGroupDisplayTime(g: FeedingViewGroup, toTimeStr: (d: Date) => string): string {
  const sum = g.members.reduce((s, m) => s + logTimestamp(m), 0);
  const avg = Math.round(sum / g.members.length);
  return toTimeStr(new Date(avg));
}

export function viewGroupNote(g: FeedingViewGroup): string {
  const parts = g.members.map((m) => (m.note || '').trim()).filter(Boolean);
  return parts.length ? parts.join(' · ') : '';
}

export function isLowVolumeViewGroup(
  g: FeedingViewGroup,
  settings: FeedingSettingsResolved
): boolean {
  return g.members.some((m) => isLowVolume(m.volume, settings));
}

export function isHighVolumeViewGroup(g: FeedingViewGroup): boolean {
  const sum = viewGroupDisplayVolume(g);
  return sum > 200 || g.members.some((m) => isHighVolume(m.volume));
}

function globalPrevLogBefore(group: FeedingViewGroup, all: FeedingLog[]): FeedingLog | undefined {
  const curTs = logTimestamp(group.members[0]);
  const memberKey = new Set(group.members.map((m) => logRowKey(m)));
  let best: FeedingLog | undefined;
  let bestTs = -Infinity;
  for (const l of all) {
    if (memberKey.has(logRowKey(l))) continue;
    const t = logTimestamp(l);
    if (t < curTs && t > bestTs) {
      bestTs = t;
      best = l;
    }
  }
  return best;
}

export function formatIntervalFromPrevViewGroup(
  g: FeedingViewGroup,
  listDesc: FeedingViewGroup[],
  allLogs: FeedingLog[]
): string {
  const idx = listDesc.findIndex((x) => viewGroupKey(x) === viewGroupKey(g));
  let prev: FeedingLog | undefined;
  if (idx >= 0 && idx < listDesc.length - 1) {
    const older = listDesc[idx + 1];
    prev = older.members[older.members.length - 1];
  } else {
    prev = globalPrevLogBefore(g, allLogs);
  }
  if (!prev) return '';
  const diffMs = logTimestamp(g.members[0]) - logTimestamp(prev);
  const diff = Math.round(diffMs / 60000);
  if (diff <= 0) return '';
  const hh = Math.floor(diff / 60);
  const mm = diff % 60;
  if (hh === 0) return `${mm}p`;
  if (mm === 0) return `${hh}h`;
  return `${hh}h${mm.toString().padStart(2, '0')}p`;
}

export function isFeedTimeGapWarningViewGroup(
  g: FeedingViewGroup,
  listDesc: FeedingViewGroup[],
  allLogs: FeedingLog[],
  settings: FeedingSettingsResolved
): boolean {
  const idx = listDesc.findIndex((x) => viewGroupKey(x) === viewGroupKey(g));
  let prev: FeedingLog | undefined;
  if (idx >= 0 && idx < listDesc.length - 1) {
    const older = listDesc[idx + 1];
    prev = older.members[older.members.length - 1];
  } else {
    prev = globalPrevLogBefore(g, allLogs);
  }
  if (!prev) return false;
  const diffMs = logTimestamp(g.members[0]) - logTimestamp(prev);
  const hours = diffMs / (1000 * 60 * 60);
  return hours >= settings.feedTimeWarningHours;
}
