export const environment = {
  production: false,
  newsApiToken: import.meta.env['NG_APP_NEWS_API_TOKEN'] || '',
  newsApiUrl: 'https://api.thenewsapi.com/v1/news/headlines',
  weatherApiKey: import.meta.env['NG_APP_WEATHER_API_KEY'] ,
  weatherApiUrl: 'https://www.meteosource.com/api/v1/free',
  googleSheetsApiKey: import.meta.env['NG_APP_GOOGLE_SHEETS_API_KEY'],
  googleClientId: import.meta.env['NG_APP_GOOGLE_CLIENT_ID'],
  googleClientSecret: import.meta.env['NG_APP_GOOGLE_CLIENT_SECRET'],
  googleAppsScriptUrl: import.meta.env['NG_APP_GOOGLE_APPS_SCRIPT_URL'],
  googleBusinessAppsScriptUrl: import.meta.env['NG_APP_GOOGLE_BUSINESS_APPS_SCRIPT_URL'],
  securitiesSheetScriptId: import.meta.env['NG_APP_SECURITIES_SHEET_SCRIPT_ID'] || '',
};

