# Google Sheets Integration for Medical History

## Overview

The medical history feature now integrates directly with Google Sheets to store and retrieve patient medical data. This allows for real-time data synchronization and easy data management through familiar spreadsheet interfaces.

## Architecture

### Components

1. **GoogleSheetsService** - Generic service for interacting with Google Sheets API
2. **MedicalHistoryService** - Specific service for medical history operations
3. **MedicalDataMapperService** - Handles data transformation between sheets and application
4. **MedicalErrorHandlerService** - Provides user-friendly error handling

### Data Flow

```
Google Sheets → GoogleSheetsService → MedicalDataMapperService → Application
```

## Google Sheets Configuration

### Sheet Structure

The medical history data is stored in a Google Sheet with the following structure:

| Column | Name | Description | Example |
|--------|------|-------------|---------|
| A | User | User identifier | phat |
| B | Ngày | Date (DD/MM/YYYY) | 03/05/2026 |
| C | Loại | Medical event type | emergency |
| D | Tiêu đề | Event title | Rối loạn tiêu hoá |
| E | Chi tiết | Detailed description | Sử dụng men vi sinh |
| F | Nơi khám | Place/Location | Bệnh viện Quốc tế City |
| G | id file Explorer | Attachment file ID | 46 |

### Sheet Configuration

```typescript
// Current configuration
const SHEET_ID = '1O4kAA61k4cX4mEwAjDy5gioVUAElCyu62Z3zPvgdDMM';
const SHEET_GID = '836488919'; // Medical History tab
```

### API Configuration

The integration requires the following environment variables:

```typescript
// environment.ts
export const environment = {
  googleSheetsApiKey: 'YOUR_GOOGLE_SHEETS_API_KEY',
  // ... other config
};
```

## Usage

### Reading Data

```typescript
// Get all medical history entries
medicalHistoryService.getEntries().subscribe({
  next: (entries) => {
    console.log(`Loaded ${entries.length} medical entries`);
  },
  error: (error) => {
    // Error is already processed through MedicalErrorHandlerService
    console.error('User-friendly message:', error.userMessage);
  }
});
```

### Adding Data

```typescript
const newEntry: MedicalHistoryEntry = {
  user: 'phat',
  date: '2026-05-03',
  kind: 'checkup',
  title: 'Khám định kỳ',
  detail: 'Khám tổng quát hàng tháng',
  place: 'Bệnh viện Đa khoa'
};

medicalHistoryService.addEntry(newEntry).subscribe({
  next: (result) => {
    if (result.success) {
      console.log('Entry added successfully');
    }
  },
  error: (error) => {
    console.error('Failed to add entry:', error.userMessage);
  }
});
```

### Testing Connection

```typescript
medicalHistoryService.testConnection().subscribe({
  next: (result) => {
    if (result.success) {
      console.log(`Connection OK: ${result.message}`);
    } else {
      console.error(`Connection failed: ${result.message}`);
    }
  }
});
```

## Error Handling

The system provides comprehensive error handling with user-friendly messages:

### Error Types

1. **Network Errors** - Connection issues, timeouts
2. **Permission Errors** - API key issues, access denied
3. **Data Errors** - Sheet not found, invalid structure
4. **Validation Errors** - Invalid data format
5. **Unknown Errors** - Generic fallback

### Error Recovery

```typescript
// Errors include recovery information
interface MedicalHistoryError {
  type: 'network' | 'validation' | 'permission' | 'data' | 'unknown';
  message: string;        // Technical message
  userMessage: string;    // User-friendly message
  actionable: boolean;    // Can user fix this?
  retryable: boolean;     // Should retry be attempted?
}
```

## Data Validation

### Required Fields

- **User**: Must not be empty
- **Date**: Must be in YYYY-MM-DD format (converted from DD/MM/YYYY)
- **Title**: Must not be empty
- **Kind**: Must be a valid medical event type

### Medical Event Types

Supported medical event types:

- `emergency` - Emergency visits
- `checkup` - Regular checkups
- `vaccination` - Vaccinations
- `follow_up` - Follow-up visits
- `surgery` - Surgical procedures
- `therapy` - Therapy sessions
- `diagnosis` - Diagnostic procedures
- `medication` - Medication records
- `other` - Other medical events

### Date Format Handling

The mapper automatically converts between formats:

- **Input**: DD/MM/YYYY (e.g., "03/05/2026")
- **Storage**: YYYY-MM-DD (e.g., "2026-05-03")
- **Display**: Localized format based on user preferences

## Performance Considerations

### Caching

The Google Sheets data is fetched on-demand and cached at the component level using Angular signals.

### Rate Limiting

Google Sheets API has rate limits:
- 100 requests per 100 seconds per user
- 500 requests per 100 seconds

The service includes automatic retry with exponential backoff for rate limit errors.

### Data Size

Currently optimized for:
- Up to 1000 medical history entries
- Response time < 2 seconds for typical loads

## Security

### API Key Management

- API keys are stored in environment variables
- Keys should have restricted scope (only Sheets API)
- Use separate keys for development and production

### Data Privacy

- No sensitive data is logged in console
- Errors are sanitized before displaying to users
- All communication uses HTTPS

## Troubleshooting

### Common Issues

1. **"API key not configured"**
   - Check `NG_APP_GOOGLE_SHEETS_API_KEY` environment variable
   - Verify API key is valid and has Sheets API enabled

2. **"Access denied"**
   - Check sheet sharing permissions
   - Verify API key has access to the sheet
   - Ensure sheet is publicly readable or shared with service account

3. **"Sheet not found"**
   - Verify SHEET_ID is correct
   - Check SHEET_GID matches the actual tab
   - Ensure sheet hasn't been deleted

4. **"Invalid date format"**
   - Check date column format in Google Sheets
   - Ensure dates are in DD/MM/YYYY format
   - Verify no empty date cells in data rows

### Debug Mode

Enable debug logging:

```typescript
// In development
console.log('Fetched rows:', rows);
console.log('Mapped entries:', entries);
```

### Manual Testing

Use the test connection method:

```typescript
medicalHistoryService.testConnection().subscribe(console.log);
```

## Future Enhancements

1. **Real-time Updates** - WebSocket integration for live updates
2. **Offline Support** - Local storage fallback when offline
3. **Bulk Operations** - Import/export multiple entries
4. **Advanced Filtering** - Server-side filtering and pagination
5. **Audit Trail** - Track all changes with timestamps and user info

## Migration Notes

### From Static Data

The previous implementation used static data arrays. The new system:

1. Maintains the same data structure (`MedicalHistoryEntry`)
2. Adds automatic data validation
3. Provides better error handling
4. Enables real-time data updates

### Breaking Changes

- None - the public API remains the same
- Internal data fetching is now asynchronous
- Error objects now include additional metadata

## API Reference

### GoogleSheetsService

```typescript
class GoogleSheetsService {
  getSheetValues(config: GoogleSheetConfig): Observable<string[][]>
  getSheetMetadata(spreadsheetId: string): Observable<GoogleSheetMetadata>
}
```

### MedicalHistoryService

```typescript
class MedicalHistoryService {
  getEntries(): Observable<MedicalHistoryEntry[]>
  addEntry(entry: MedicalHistoryEntry): Observable<MedicalSheetResponse>
  updateEntry(rowIndex: number, patch: Partial<MedicalHistoryEntry>): Observable<MedicalSheetResponse>
  deleteEntry(rowIndex: number): Observable<MedicalSheetResponse>
  testConnection(): Observable<{success: boolean, message: string, rowCount: number}>
}
```

### MedicalDataMapperService

```typescript
class MedicalDataMapperService {
  mapRowToEntry(row: string[], rowIndex: number): MedicalHistoryEntry | null
  mapRowsToEntries(rows: string[][]): MedicalHistoryEntry[]
  validateEntry(entry: Partial<MedicalHistoryEntry>): string[]
  getAvailableKinds(): MedicalKindMeta[]
}
```