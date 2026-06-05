/**
 * Notification feature patch for Feeding Apps Script.
 *
 * Sheet columns (tab "Notification"):
 *   A: User
 *   B: Noi dung
 *   C: Acknowledge List (comma-separated usernames)
 *   D: Ngay tao (ISO datetime)
 *
 * Add these cases to `doPost` switch:
 *   case 'addNotification': return _json(handleAddNotification(body));
 *   case 'acknowledgeNotification': return _json(handleAcknowledgeNotification(body));
 *   case 'deleteNotification': return _json(handleDeleteNotification(body));
 */

const NOTIFICATION_SHEET = 'Notification';

function _ensureNotificationSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(NOTIFICATION_SHEET);
  if (!sh) {
    sh = ss.insertSheet(NOTIFICATION_SHEET);
  }
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, 4).setValues([['User', 'Noi dung', 'Acknowledge List', 'Ngay tao']]);
  } else {
    const header = sh.getRange(1, 1, 1, 4).getValues()[0];
    if (!String(header[0] || '').trim()) sh.getRange(1, 1).setValue('User');
    if (!String(header[1] || '').trim()) sh.getRange(1, 2).setValue('Noi dung');
    if (!String(header[2] || '').trim()) sh.getRange(1, 3).setValue('Acknowledge List');
    if (!String(header[3] || '').trim()) sh.getRange(1, 4).setValue('Ngay tao');
  }
  return sh;
}

function _normalizeUsersCsv(csvText) {
  return String(csvText || '')
    .split(',')
    .map((v) => String(v || '').trim().toLowerCase())
    .filter((v, idx, arr) => v && arr.indexOf(v) === idx);
}

function handleAddNotification(body) {
  const payload = body && body.notification ? body.notification : {};
  const user = String(payload.user || '').trim().toLowerCase();
  const content = String(payload.content || '').trim();
  const createdAt = String(payload.createdAt || '').trim() || new Date().toISOString();
  if (!user) return { success: false, error: 'Missing user' };
  if (!content) return { success: false, error: 'Missing content' };

  const sh = _ensureNotificationSheet();
  sh.appendRow([user, content, '', createdAt]);

  return { success: true, rowIndex: sh.getLastRow() };
}

function handleAcknowledgeNotification(body) {
  const row = Number(body && body.row);
  const user = String((body && body.user) || '')
    .trim()
    .toLowerCase();
  if (!row || row < 2) return { success: false, error: 'Invalid row' };
  if (!user) return { success: false, error: 'Missing user' };

  const sh = _ensureNotificationSheet();
  const lastRow = sh.getLastRow();
  if (row > lastRow) return { success: false, error: 'Row out of range' };

  const currentCsv = sh.getRange(row, 3).getDisplayValue();
  const users = _normalizeUsersCsv(currentCsv);
  if (users.indexOf(user) === -1) {
    users.push(user);
  }
  sh.getRange(row, 3).setValue(users.join(','));

  return { success: true };
}

function handleDeleteNotification(body) {
  const row = Number(body && body.row);
  const actor = String((body && body.user) || '')
    .trim()
    .toLowerCase();
  if (!row || row < 2) return { success: false, error: 'Invalid row' };
  if (!actor) return { success: false, error: 'Missing user' };

  const sh = _ensureNotificationSheet();
  const lastRow = sh.getLastRow();
  if (row > lastRow) return { success: false, error: 'Row out of range' };

  const owner = String(sh.getRange(row, 1).getDisplayValue() || '')
    .trim()
    .toLowerCase();
  if (!owner) return { success: false, error: 'Notification owner is empty' };
  if (owner !== actor) {
    return { success: false, error: 'Only notification creator can delete this row' };
  }

  sh.deleteRow(row);
  return { success: true };
}
