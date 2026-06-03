import { Injectable } from '@angular/core';
import { MedicalEventKind, MedicalHistoryEntry } from '../../../services/medical-history.service';
import { MEDICAL_KINDS } from './medical-history-kinds.data';

/**
 * Service to map Google Sheets raw data to MedicalHistoryEntry objects
 * Handles data validation, date parsing, and type mapping
 */
@Injectable({
  providedIn: 'root'
})
export class MedicalDataMapperService {

  private readonly KIND_SET = new Set<string>(
    MEDICAL_KINDS.map(k => k.id as string)
  );

  /**
   * Map Google Sheets row data to MedicalHistoryEntry
   * Expected columns:
   * A: User
   * B: Ngày (Date in DD/MM/YYYY format)
   * C: Loại (Type/Kind)
   * D: Tiêu đề (Title)
   * E: Chi tiết (Details)
   * F: Nơi khám (Place)
   * G: Google Drive file ID (Attachment ID)
   */
  mapRowToEntry(row: string[], rowIndex: number): MedicalHistoryEntry | null {
    if (!row || row.length < 4) {
      return null;
    }

    const rowUser = (row[0] || '').trim();
    const dateStr = (row[1] || '').trim();
    const kindRaw = (row[2] || '').trim();
    const title = (row[3] || '').trim();
    const detail = (row[4] || '').trim();
    const place = (row[5] || '').trim();
    const attachRaw = (row[6] || '').toString().trim();

    // Validate required fields
    if (!dateStr || !title) {
      return null;
    }

    // Parse date
    const date = this.parseSheetDate(dateStr);
    if (!date) {
      console.warn(`Invalid date format in row ${rowIndex + 2}: ${dateStr}`);
      return null;
    }

    return {
      user: rowUser.toLowerCase() || 'guest',
      date,
      kind: this.parseKind(kindRaw),
      title,
      detail,
      place: place || undefined,
      driveFileId: attachRaw || undefined,
      rowIndex: rowIndex + 2, // +2 because we start from row 2 in sheets (1-indexed + skip header)
    };
  }

  /**
   * Map multiple rows to entries, filtering out invalid ones
   */
  mapRowsToEntries(rows: string[][]): MedicalHistoryEntry[] {
    return rows
      .map((row, index) => this.mapRowToEntry(row, index))
      .filter((entry): entry is MedicalHistoryEntry => entry !== null)
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending (newest first)
  }

  /**
   * Parse date from DD/MM/YYYY format to YYYY-MM-DD
   */
  private parseSheetDate(dateStr: string): string | null {
    const trimmed = dateStr.trim();

    // Handle DD/MM/YYYY format
    const ddmmyyyyMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (ddmmyyyyMatch) {
      const day = ddmmyyyyMatch[1].padStart(2, '0');
      const month = ddmmyyyyMatch[2].padStart(2, '0');
      const year = ddmmyyyyMatch[3];

      // Validate date values
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);

      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900) {
        return `${year}-${month}-${day}`;
      }
    }

    // Handle YYYY-MM-DD format (already correct)
    const yyyymmddMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (yyyymmddMatch) {
      return trimmed;
    }

    // Handle other common formats
    const dateObj = new Date(trimmed);
    if (!isNaN(dateObj.getTime())) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return null;
  }

  /**
   * Parse and validate medical event kind
   */
  private parseKind(raw: string): MedicalEventKind {
    const normalized = String(raw ?? '')
      .trim()
      .toLowerCase();

    return this.KIND_SET.has(normalized) ? (normalized as MedicalEventKind) : 'other';
  }

  /**
   * Validate entry data before saving
   */
  validateEntry(entry: Partial<MedicalHistoryEntry>): string[] {
    const errors: string[] = [];

    if (!entry.user || entry.user.trim() === '') {
      errors.push('User is required');
    }

    if (!entry.date || entry.date.trim() === '') {
      errors.push('Date is required');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
      errors.push('Date must be in YYYY-MM-DD format');
    }

    if (!entry.title || entry.title.trim() === '') {
      errors.push('Title is required');
    }

    if (!entry.kind) {
      errors.push('Medical event kind is required');
    } else if (!this.KIND_SET.has(entry.kind)) {
      errors.push('Invalid medical event kind');
    }

    return errors;
  }

  /**
   * Get available medical event kinds with labels
   */
  getAvailableKinds() {
    return MEDICAL_KINDS.map(kind => ({
      id: kind.id,
      label: kind.label,
      shortLabel: kind.shortLabel,
      icon: kind.icon,
      color: kind.color
    }));
  }
}
