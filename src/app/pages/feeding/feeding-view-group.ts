import type { FeedingLog } from '../../services/feeding-log.service';

/** Một dòng hiển thị sau khi gom các cữ gần nhau (cùng sheet row vẫn tách). */
export interface FeedingViewGroup {
  members: FeedingLog[];
}

/**
 * Gom cữ có khoảng cách (chuỗi) ≤ `gapMinutes` phút thành một nhóm.
 * `gapMinutes` ≤ 0 → mỗi cữ một nhóm (không gom).
 * Trả về thứ tự **mới → cũ** (đồng bộ list log hiện tại).
 */
export function groupLogsByProximity(
  logsAnyOrder: FeedingLog[],
  gapMinutes: number,
  timestampMs: (l: FeedingLog) => number
): FeedingViewGroup[] {
  if (!logsAnyOrder.length) return [];
  if (!gapMinutes || gapMinutes <= 0) {
    const desc = [...logsAnyOrder].sort(
      (a, b) => timestampMs(b) - timestampMs(a)
    );
    return desc.map((m) => ({ members: [m] }));
  }

  const asc = [...logsAnyOrder].sort(
    (a, b) => timestampMs(a) - timestampMs(b)
  );
  const clusters: FeedingLog[][] = [];
  for (const l of asc) {
    if (!clusters.length) {
      clusters.push([l]);
      continue;
    }
    const cur = clusters[clusters.length - 1];
    const last = cur[cur.length - 1];
    if ((timestampMs(l) - timestampMs(last)) / 60000 <= gapMinutes) {
      cur.push(l);
    } else {
      clusters.push([l]);
    }
  }
  return clusters.map((members) => ({ members })).reverse();
}
