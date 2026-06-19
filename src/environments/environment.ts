export const environment = {
  production: false,
  weatherApiKey: import.meta.env['NG_APP_WEATHER_API_KEY'],
  weatherApiUrl: 'https://www.meteosource.com/api/v1/free',
  googleSheetsApiKey: import.meta.env['NG_APP_GOOGLE_SHEETS_API_KEY'],
  googleClientId: import.meta.env['NG_APP_GOOGLE_CLIENT_ID'],
  googleAppsScriptUrl: import.meta.env['NG_APP_GOOGLE_APPS_SCRIPT_URL'],
  googleBusinessAppsScriptUrl: import.meta.env['NG_APP_GOOGLE_BUSINESS_APPS_SCRIPT_URL'],
  googleFeedingAppsScriptUrl: import.meta.env['NG_APP_GOOGLE_FEEDING_APPS_SCRIPT_URL'] || '',
  googleFeedingSheetId: import.meta.env['NG_APP_GOOGLE_FEEDING_SHEET_ID'] || '',
  enableExplorer: import.meta.env['NG_APP_ENABLE_EXPLORER'] === 'true',
  appsScriptDirect: import.meta.env['NG_APP_APPS_SCRIPT_MODE'] === 'direct',
  googleBusinessSheetId: import.meta.env['NG_APP_GOOGLE_BUSINESS_SHEET_ID'] || '',
  googleExpenseSheetId: import.meta.env['NG_APP_GOOGLE_EXPENSE_SHEET_ID'] || '',
  huggingfaceToken: import.meta.env['NG_APP_HUGGINGFACE_TOKEN'] || '',
  /** Explorer/Documents tab in the Feeding app is enabled only when this is "true". */
  enableExplorer: import.meta.env['NG_APP_ENABLE_EXPLORER'] === 'true',
  /** When true, all Apps Script calls go directly to the Google Script exec URL.
   *  When false (default), they go through the Vercel /api/* proxy functions. */
  appsScriptDirect: import.meta.env['NG_APP_APPS_SCRIPT_MODE'] === 'direct',
};
