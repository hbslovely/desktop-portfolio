#!/usr/bin/env node
/**
 * generate-medical-report.mjs
 *
 * Fetches ALL rows from the medical-history Google Sheet tab and builds a
 * well-formatted Markdown + PDF report covering every entry in the sheet.
 * REPORT_DATE is used only as the file name label, not as a data filter.
 *
 * Output (written to ./reports/):
 *   medical-report-YYYY-MM-DD.md
 *   medical-report-YYYY-MM-DD.pdf
 *
 * Required environment variables:
 *   GOOGLE_SHEETS_API_KEY          — public read-only API key
 *   GOOGLE_FEEDING_SHEET_ID        — spreadsheet ID
 *   GOOGLE_MEDICAL_SHEET_GID       — GID of the "Y Tế" tab (e.g. 631680908)
 *   REPORT_DATE                    — ISO date used as file label (default: today UTC)
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────

const SHEET_ID  = process.env.GOOGLE_FEEDING_SHEET_ID;
const API_KEY   = process.env.GOOGLE_SHEETS_API_KEY;
const SHEET_GID = process.env.GOOGLE_MEDICAL_SHEET_GID;
const REPORT_DATE = process.env.REPORT_DATE || new Date().toISOString().slice(0, 10);

if (!SHEET_ID || !API_KEY) {
  console.error('Missing GOOGLE_FEEDING_SHEET_ID or GOOGLE_SHEETS_API_KEY');
  process.exit(1);
}
if (!SHEET_GID) {
  console.error('Missing GOOGLE_MEDICAL_SHEET_GID');
  process.exit(1);
}

// ─── Medical kind metadata (mirrors medical-history-kinds.data.ts) ────────────

const MEDICAL_KINDS = {
  vaccine:      { label: 'Tiêm chủng / Vaccine',              emoji: '💉' },
  checkup:      { label: 'Khám định kỳ',                      emoji: '🩺' },
  medication:   { label: 'Thuốc / Kê đơn',                    emoji: '💊' },
  illness:      { label: 'Ốm / Sốt / Triệu chứng',           emoji: '🤒' },
  lab:          { label: 'Xét nghiệm / Kết quả',             emoji: '🔬' },
  allergy:      { label: 'Dị ứng / Phản ứng',                emoji: '⚠️' },
  dental:       { label: 'Răng miệng / Nha khoa',             emoji: '🦷' },
  ent:          { label: 'Tai – Mũi – Họng',                  emoji: '👂' },
  dermatology:  { label: 'Da liễu',                           emoji: '🩹' },
  vision:       { label: 'Mắt / Nhãn khoa',                   emoji: '👁️' },
  hearing:      { label: 'Thính lực',                         emoji: '🔊' },
  emergency:    { label: 'Cấp cứu / ER',                      emoji: '🚨' },
  surgery:      { label: 'Phẫu thuật',                        emoji: '🔪' },
  therapy:      { label: 'Vật lý trị liệu / PHCN',           emoji: '🏥' },
  nutrition:    { label: 'Dinh dưỡng / Tư vấn sữa',          emoji: '🥗' },
  screening:    { label: 'Sàng lọc',                          emoji: '📋' },
  mental:       { label: 'Tâm lý / Thần kinh',                emoji: '🧠' },
  home_care:    { label: 'Chăm sóc tại nhà',                  emoji: '🏠' },
  follow_up:    { label: 'Tái khám / Theo dõi',               emoji: '📅' },
  other:        { label: 'Khác',                              emoji: '📌' },
};

function kindLabel(slug) {
  return MEDICAL_KINDS[slug]?.label ?? slug;
}
function kindEmoji(slug) {
  return MEDICAL_KINDS[slug]?.emoji ?? '📌';
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} fetching ${url}: ${body}`);
  }
  return res.json();
}

async function getSheetNameByGid(spreadsheetId, gid) {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    `?key=${API_KEY}&fields=sheets(properties(sheetId,title))`;
  const meta = await fetchJson(url);
  const sheet = meta.sheets?.find(
    (s) => String(s.properties.sheetId) === String(gid)
  );
  if (!sheet) throw new Error(`Sheet with GID ${gid} not found in spreadsheet ${spreadsheetId}`);
  return sheet.properties.title;
}

async function getSheetRows(spreadsheetId, sheetName, range = 'A2:H') {
  const fullRange = encodeURIComponent(`'${sheetName}'!${range}`);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    `/values/${fullRange}?key=${API_KEY}&valueRenderOption=FORMATTED_VALUE`;
  const data = await fetchJson(url);
  return data.values || [];
}

// ─── Row → entry ──────────────────────────────────────────────────────────────

/**
 * Columns (0-indexed, from row A2 onward):
 *   0 A  User
 *   1 B  Ngày (DD/MM/YYYY)
 *   2 C  Loại (slug)
 *   3 D  Tiêu đề
 *   4 E  Chi tiết
 *   5 F  Nơi khám
 *   6 G  Google Drive file ID
 */
function parseDate(raw) {
  if (!raw) return null;
  // DD/MM/YYYY
  const m1 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
  // fallback
  const d = new Date(raw.trim());
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function rowToEntry(row, idx) {
  const user    = (row[0] ?? '').trim();
  const dateRaw = (row[1] ?? '').trim();
  const kind    = (row[2] ?? 'other').trim().toLowerCase();
  const title   = (row[3] ?? '').trim();
  const detail  = (row[4] ?? '').trim();
  const place   = (row[5] ?? '').trim();
  const driveId = (row[6] ?? '').trim();

  if (!dateRaw || !title) return null;
  const date = parseDate(dateRaw);
  if (!date) {
    console.warn(`Row ${idx + 2}: cannot parse date "${dateRaw}" — skipped`);
    return null;
  }
  return { user, date, kind, title, detail, place, driveId };
}

// ─── Markdown builder ─────────────────────────────────────────────────────────

function userDisplayName(user) {
  if (!user || user === 'guest') return 'Gia đình';
  // capitalise first letter
  return user.charAt(0).toUpperCase() + user.slice(1);
}

function formatDateVi(isoDate) {
  // isoDate: YYYY-MM-DD
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function buildMarkdown(entries, reportDate) {
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const totalEntries = entries.length;

  // Summary by kind
  const kindCount = {};
  const userCount = {};
  for (const e of entries) {
    kindCount[e.kind] = (kindCount[e.kind] ?? 0) + 1;
    const u = userDisplayName(e.user);
    userCount[u] = (userCount[u] ?? 0) + 1;
  }

  // Group entries by year → month
  const byYear = {};
  for (const e of entries) {
    const [y, m] = e.date.split('-');
    (byYear[y] ??= {})[m] ??= [];
    byYear[y][m].push(e);
  }

  const MONTH_VI = [
    '', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
    'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
    'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
  ];

  const lines = [];

  // ── Cover ──
  lines.push(
    `# 📋 Hồ Sơ Y Tế Gia Đình`,
    ``,
    `| | |`,
    `|---|---|`,
    `| **Ngày báo cáo** | ${formatDateVi(reportDate)} |`,
    `| **Tổng số hồ sơ** | ${totalEntries} bản ghi |`,
    `| **Cập nhật lúc** | ${generatedAt} |`,
    ``,
    `---`,
    ``,
  );

  // ── Summary stats ──
  lines.push(`## 📊 Tổng Quan`, ``);

  lines.push(`### Theo người dùng`, ``);
  lines.push(`| Người | Số lần |`);
  lines.push(`|-------|--------|`);
  for (const [u, cnt] of Object.entries(userCount).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${u} | ${cnt} |`);
  }
  lines.push(``);

  lines.push(`### Theo loại hồ sơ`, ``);
  lines.push(`| Loại | Số lần |`);
  lines.push(`|------|--------|`);
  for (const [slug, cnt] of Object.entries(kindCount).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${kindEmoji(slug)} ${kindLabel(slug)} | ${cnt} |`);
  }
  lines.push(``);

  lines.push(`---`, ``);

  // ── Chronological detail ──
  lines.push(`## 🗂️ Chi Tiết Hồ Sơ Theo Năm`, ``);

  const sortedYears = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
  for (const year of sortedYears) {
    lines.push(`### ${year}`, ``);
    const sortedMonths = Object.keys(byYear[year]).sort((a, b) => b.localeCompare(a));
    for (const month of sortedMonths) {
      lines.push(`#### ${MONTH_VI[parseInt(month, 10)] ?? `Tháng ${month}`}`, ``);

      const monthEntries = byYear[year][month].sort((a, b) => b.date.localeCompare(a.date));
      for (const e of monthEntries) {
        lines.push(
          `<details>`,
          `<summary>${kindEmoji(e.kind)} <strong>${formatDateVi(e.date)}</strong> — ${e.title}` +
            (e.user && e.user !== 'guest' ? ` <em>(${userDisplayName(e.user)})</em>` : '') +
            `</summary>`,
          ``,
          `| Trường | Nội dung |`,
          `|--------|---------|`,
          `| **Ngày** | ${formatDateVi(e.date)} |`,
          `| **Loại** | ${kindEmoji(e.kind)} ${kindLabel(e.kind)} |`,
          `| **Người** | ${userDisplayName(e.user)} |`,
          `| **Tiêu đề** | ${e.title} |`,
        );
        if (e.detail)  lines.push(`| **Chi tiết** | ${e.detail.replace(/\n/g, '<br>').replace(/\|/g, '\\|')} |`);
        if (e.place)   lines.push(`| **Nơi khám** | ${e.place} |`);
        if (e.driveId) lines.push(`| **Đính kèm** | [Xem tệp](https://drive.google.com/file/d/${e.driveId}/view) |`);
        lines.push(``, `</details>`, ``);
      }
    }
  }

  lines.push(`---`, ``);
  lines.push(`*Báo cáo được tạo tự động bởi GitHub Actions từ Google Sheets.*`);

  return lines.join('\n');
}

// ─── PDF via md-to-pdf ────────────────────────────────────────────────────────

async function convertToPdf(mdPath, pdfPath) {
  // Dynamically import md-to-pdf (ESM-only package installed at workflow runtime)
  const { mdToPdf } = await import('md-to-pdf');
  await mdToPdf(
    { path: mdPath },
    {
      dest: pdfPath,
      pdf_options: {
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
        printBackground: true,
      },
      stylesheet_encoding: 'utf-8',
      css: `
        body { font-family: "Segoe UI", Arial, sans-serif; font-size: 13px; color: #1a1a2e; }
        h1 { font-size: 24px; color: #0f4c81; border-bottom: 3px solid #0f4c81; padding-bottom: 8px; }
        h2 { font-size: 18px; color: #1e5f99; border-bottom: 1px solid #cde; padding-bottom: 4px; margin-top: 28px; }
        h3 { font-size: 15px; color: #2d7abf; margin-top: 20px; }
        h4 { font-size: 13px; color: #3a8fbf; margin-top: 14px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
        th { background: #0f4c81; color: #fff; padding: 6px 10px; text-align: left; }
        td { padding: 5px 10px; border-bottom: 1px solid #e0e8f0; }
        tr:nth-child(even) td { background: #f5f9fd; }
        details summary { cursor: pointer; padding: 6px 0; font-weight: 500; }
        details[open] { background: #f9fbff; border-left: 3px solid #0f4c81; padding-left: 12px; margin-bottom: 10px; }
        hr { border: none; border-top: 1px solid #cde; margin: 24px 0; }
        em { color: #666; }
        a { color: #0f4c81; }
      `,
    }
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Generating medical report for ${REPORT_DATE}…`);

  // 1. Resolve sheet name from GID
  console.log(`Resolving sheet name for GID ${SHEET_GID}…`);
  const sheetName = await getSheetNameByGid(SHEET_ID, SHEET_GID);
  console.log(`Sheet name: "${sheetName}"`);

  // 2. Fetch all rows
  console.log(`Fetching rows from "${sheetName}"…`);
  const rows = await getSheetRows(SHEET_ID, sheetName, 'A2:H');
  console.log(`Fetched ${rows.length} raw rows`);

  // 3. Parse entries
  const entries = rows
    .map((r, i) => rowToEntry(r, i))
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));
  console.log(`Parsed ${entries.length} valid entries`);

  if (entries.length === 0) {
    console.warn('No entries found — report will be empty.');
  }

  // 4. Write Markdown
  const outDir = resolve(process.cwd(), 'reports');
  mkdirSync(outDir, { recursive: true });

  const mdPath  = resolve(outDir, `medical-report-${REPORT_DATE}.md`);
  const pdfPath = resolve(outDir, `medical-report-${REPORT_DATE}.pdf`);

  const markdown = buildMarkdown(entries, REPORT_DATE);
  writeFileSync(mdPath, markdown, 'utf-8');
  console.log(`Markdown written → ${mdPath}`);

  // 5. Convert to PDF
  console.log('Converting to PDF…');
  await convertToPdf(mdPath, pdfPath);
  console.log(`PDF written → ${pdfPath}`);

  // 6. Emit output paths for the workflow to consume
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `md_path=${mdPath}\npdf_path=${pdfPath}\nreport_date=${REPORT_DATE}\n`
    );
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
