import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface GoogleSheetConfig {
  spreadsheetId: string;
  sheetName?: string;
  sheetGid?: string;
  range?: string;
}

export interface GoogleSheetMetadata {
  sheets: Array<{
    properties: {
      sheetId: number;
      title: string;
      index: number;
    };
  }>;
}

export interface GoogleSheetValuesResponse {
  range: string;
  majorDimension: string;
  values: string[][];
}

@Injectable({
  providedIn: 'root'
})
export class GoogleSheetsService {
  private http = inject(HttpClient);
  private readonly API_KEY = environment.googleSheetsApiKey;

  /**
   * Get values from a Google Sheet with flexible configuration
   */
  getSheetValues(config: GoogleSheetConfig): Observable<string[][]> {
    if (!this.API_KEY) {
      return throwError(() => new Error('Google Sheets API key not configured'));
    }

    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}`;

    // If we have a sheet name, use it directly
    if (config.sheetName) {
      const range = config.range || 'A:Z';
      const fullRange = `'${config.sheetName}'!${range}`;
      return this.fetchValues(baseUrl, fullRange);
    }

    // If we have a GID, find the sheet name first
    if (config.sheetGid) {
      return this.getSheetNameByGid(baseUrl, config.sheetGid).pipe(
        switchMap(sheetName => {
          const range = config.range || 'A:Z';
          const fullRange = `'${sheetName}'!${range}`;
          return this.fetchValues(baseUrl, fullRange);
        })
      );
    }

    return throwError(() => new Error('Either sheetName or sheetGid must be provided'));
  }

  /**
   * Get sheet metadata including all sheet names and IDs
   */
  getSheetMetadata(spreadsheetId: string): Observable<GoogleSheetMetadata> {
    if (!this.API_KEY) {
      return throwError(() => new Error('Google Sheets API key not configured'));
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${this.API_KEY}&fields=sheets(properties(sheetId,title,index))`;

    return this.http.get<GoogleSheetMetadata>(url).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Find sheet name by GID
   */
  private getSheetNameByGid(baseUrl: string, gid: string): Observable<string> {
    const metadataUrl = `${baseUrl}?key=${this.API_KEY}&fields=sheets(properties(sheetId,title))`;

    return this.http.get<GoogleSheetMetadata>(metadataUrl).pipe(
      map(metadata => {
        const targetSheet = metadata.sheets.find(
          sheet => sheet.properties.sheetId.toString() === gid
        );

        if (!targetSheet) {
          throw new Error(`Sheet with GID ${gid} not found`);
        }

        return targetSheet.properties.title;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Fetch values from a specific range
   */
  private fetchValues(baseUrl: string, range: string): Observable<string[][]> {
    const url = `${baseUrl}/values/${encodeURIComponent(range)}?key=${this.API_KEY}&valueRenderOption=FORMATTED_VALUE`;

    return this.http.get<GoogleSheetValuesResponse>(url).pipe(
      map(response => response.values || []),
      catchError(this.handleError)
    );
  }

  /**
   * Handle HTTP errors with user-friendly messages
   */
  private handleError = (error: HttpErrorResponse) => {
    let errorMessage = 'An error occurred while accessing Google Sheets';

    if (error.status === 400) {
      errorMessage = 'Invalid request to Google Sheets API';
    } else if (error.status === 403) {
      errorMessage = 'Access denied to Google Sheets. Check API key permissions.';
    } else if (error.status === 404) {
      errorMessage = 'Google Sheet not found or does not exist';
    } else if (error.error?.error?.message) {
      errorMessage = error.error.error.message;
    }

    console.error('GoogleSheetsService error:', error);
    return throwError(() => new Error(errorMessage));
  };
}