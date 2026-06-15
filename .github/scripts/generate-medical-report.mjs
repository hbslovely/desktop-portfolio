#!/usr/bin/env node
/**
 * generate-medical-report.mjs
 *
 * Fetches ALL rows from the "Y Tế" Google Sheet tab.
 * Each row → 1 Markdown file + 1 PDF file.
 *
 * File naming: YYYY-MM-DD_{kind}_{slug-title}_{user}.md / .pdf
 * Example:     2026-06-10_vaccine_tiem-phong-mui-1_baby.pdf
 *
 * Output: written to ./reports/
 *
 * Also writes ./reports/manifest.json — array of { mdPath, pdfPath, entry }
 * so the workflow knows exactly which files to upload.
 *
 * Required environment variables:
 *   GOOGLE_SHEETS_API_KEY
 *   GOOGLE_FEEDING_SHEET_ID
 *   GOOGLE_MEDICAL_SHEET_GID   — GID of the "Y Tế" tab
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Config ───────────────────────────────────────────────────────────────────

const SHEET_ID  = process.env.GOOGLE_FEEDING_SHEET_ID;
const API_KEY   = process.env.GOOGLE_SHEETS_API_KEY;
const SHEET_GID = process.env.GOOGLE_MEDICAL_SHEET_GID;

if (!SHEET_ID || !API_KEY) {
  console.error('Missing GOOGLE_FEEDING_SHEET_ID or GOOGLE_SHEETS_API_KEY');
  process.exit(1);
}
if (!SHEET_GID) {
  console.error('Missing GOOGLE_MEDICAL_SHEET_GID');
  process.exit(1);
}

// ─── Medical kind metadata ────────────────────────────────────────────────────

const MEDICAL_KINDS = {
  vaccine:     { label: 'Tiêm chủng / Vaccine',        emoji: '💉' },
  checkup:     { label: 'Khám định kỳ',                emoji: '🩺' },
  medication:  { label: 'Thuốc / Kê đơn',              emoji: '💊' },
  illness:     { label: 'Ốm / Sốt / Triệu chứng',     emoji: '🤒' },
  lab:         { label: 'Xét nghiệm / Kết quả',       emoji: '🔬' },
  allergy:     { label: 'Dị ứng / Phản ứng',          emoji: '⚠️'  },
  dental:      { label: 'Răng miệng / Nha khoa',       emoji: '🦷' },
  ent:         { label: 'Tai – Mũi – Họng',            emoji: '👂' },
  dermatology: { label: 'Da liễu',                     emoji: '🩹' },
  vision:      { label: 'Mắt / Nhãn khoa',             emoji: '👁️' },
  hearing:     { label: 'Thính lực',                   emoji: '🔊' },
  emergency:   { label: 'Cấp cứu / ER',                emoji: '🚨' },
  surgery:     { label: 'Phẫu thuật',                  emoji: '🔪' },
  therapy:     { label: 'Vật lý trị liệu / PHCN',     emoji: '🏥' },
  nutrition:   { label: 'Dinh dưỡng / Tư vấn sữa',    emoji: '🥗' },
  screening:   { label: 'Sàng lọc',                    emoji: '📋' },
  mental:      { label: 'Tâm lý / Thần kinh',          emoji: '🧠' },
  home_care:   { label: 'Chăm sóc tại nhà',            emoji: '🏠' },
  follow_up:   { label: 'Tái khám / Theo dõi',         emoji: '📅' },
  other:       { label: 'Khác',                        emoji: '📌' },
};

const kindLabel = (slug) => MEDICAL_KINDS[slug]?.label ?? slug;
const kindEmoji = (slug) => MEDICAL_KINDS[slug]?.emoji ?? '📌';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (!sheet) throw new Error(`Sheet GID ${gid} not found`);
  return sheet.properties.title;
}

async function getSheetRows(spreadsheetId, sheetName) {
  const range = encodeURIComponent(`'${sheetName}'!A2:H`);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    `/values/${range}?key=${API_KEY}&valueRenderOption=FORMATTED_VALUE`;
  const data = await fetchJson(url);
  return data.values || [];
}

function parseDate(raw) {
  if (!raw) return null;
  const m1 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
  const d = new Date(raw.trim());
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function formatDateVi(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function userDisplay(user) {
  if (!user || user === 'guest') return 'Gia đình';
  return user.charAt(0).toUpperCase() + user.slice(1);
}

/**
 * Convert a Vietnamese string to a safe ASCII slug for filenames.
 * Strips diacritics, replaces spaces with hyphens, max 40 chars.
 */
function toSlug(str) {
  return str
    .normalize('NFD')
    .replace(/\p{M}/gu, '')        // strip combining marks
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 40)
    .replace(/-+$/, '');           // trim trailing dashes
}

/**
 * Build the base filename (without extension) for one entry.
 * Pattern: YYYY-MM-DD_{kind}_{title-slug}_{user}
 */
function entryBaseName(entry) {
  const titleSlug = toSlug(entry.title) || 'record';
  const userSlug  = toSlug(entry.user || 'family') || 'family';
  return `${entry.date}_${entry.kind}_${titleSlug}_${userSlug}`;
}

// ─── Per-entry Markdown ───────────────────────────────────────────────────────

function buildEntryMarkdown(entry) {
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  const lines = [
    `# ${kindEmoji(entry.kind)} ${entry.title}`,
    ``,
    `| Trường | Nội dung |`,
    `|--------|----------|`,
    `| **Ngày** | ${formatDateVi(entry.date)} |`,
    `| **Loại** | ${kindEmoji(entry.kind)} ${kindLabel(entry.kind)} |`,
    `| **Người** | ${userDisplay(entry.user)} |`,
  ];

  if (entry.detail) {
    lines.push(`| **Chi tiết** | ${entry.detail.replace(/\n/g, '<br>').replace(/\|/g, '\\|')} |`);
  }
  if (entry.place) {
    lines.push(`| **Nơi khám** | ${entry.place} |`);
  }
  if (entry.driveId) {
    lines.push(`| **Đính kèm** | [Xem tệp](https://drive.google.com/file/d/${entry.driveId}/view) |`);
  }

  lines.push(
    ``,
    `---`,
    ``,
    `> *Tạo tự động lúc ${generatedAt} từ Google Sheets.*`,
  );

  return lines.join('\n');
}

// ─── PDF converter ────────────────────────────────────────────────────────────

const PDF_CSS = `
  body { font-family: "Segoe UI", Arial, sans-serif; font-size: 13px; color: #1a1a2e; }
  h1   { font-size: 22px; color: #0f4c81; border-bottom: 3px solid #0f4c81; padding-bottom: 8px; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th   { background: #0f4c81; color: #fff; padding: 7px 12px; text-align: left; }
  td   { padding: 6px 12px; border-bottom: 1px solid #e0e8f0; }
  tr:nth-child(even) td { background: #f5f9fd; }
  hr   { border: none; border-top: 1px solid #cde; margin: 20px 0; }
  a    { color: #0f4c81; }
  blockquote { color: #666; border-left: 3px solid #cde; padding-left: 12px; margin: 0; }
`;

async function convertToPdf(mdPath, pdfPath) {
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
      css: PDF_CSS,
    }
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Resolve sheet name
  console.log(`Resolving sheet name for GID ${SHEET_GID}…`);
  const sheetName = await getSheetNameByGid(SHEET_ID, SHEET_GID);
  console.log(`Sheet: "${sheetName}"`);

  // 2. Fetch rows
  console.log('Fetching rows…');
  const rows = await getSheetRows(SHEET_ID, sheetName);
  console.log(`${rows.length} raw rows fetched`);

  // 3. Parse entries
  const entries = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const user    = (row[0] ?? '').trim();
    const dateRaw = (row[1] ?? '').trim();
    const kind    = (row[2] ?? 'other').trim().toLowerCase();
    const title   = (row[3] ?? '').trim();
    const detail  = (row[4] ?? '').trim();
    const place   = (row[5] ?? '').trim();
    const driveId = (row[6] ?? '').trim();

    if (!dateRaw || !title) {
      console.warn(`Row ${i + 2}: missing date or title — skipped`);
      continue;
    }
    const date = parseDate(dateRaw);
    if (!date) {
      console.warn(`Row ${i + 2}: invalid date "${dateRaw}" — skipped`);
      continue;
    }
    entries.push({ user, date, kind, title, detail, place, driveId, rowIndex: i + 2 });
  }
  console.log(`${entries.length} valid entries`);

  // 4. Create output dir
  const outDir = resolve(process.cwd(), 'reports');
  mkdirSync(outDir, { recursive: true });

  // 5. Generate one MD + PDF per entry
  const manifest = [];
  for (const entry of entries) {
    const base    = entryBaseName(entry);
    const mdPath  = resolve(outDir, `${base}.md`);
    const pdfPath = resolve(outDir, `${base}.pdf`);

    console.log(`  [Row ${entry.rowIndex}] → ${base}`);

    // Write Markdown
    const markdown = buildEntryMarkdown(entry);
    writeFileSync(mdPath, markdown, 'utf-8');

    // Convert to PDF
    await convertToPdf(mdPath, pdfPath);

    manifest.push({ base, mdPath, pdfPath, mdName: `${base}.md`, pdfName: `${base}.pdf`, entry });
  }

  // 6. Write manifest for the workflow
  const manifestPath = resolve(outDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\nManifest written → ${manifestPath}`);
  console.log(`Total: ${manifest.length} entries → ${manifest.length * 2} files`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
