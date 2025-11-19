export const environment = {
  production: true,
  newsApiToken: import.meta.env['NEWS_API_TOKEN'] || '',
  newsApiUrl: 'https://api.thenewsapi.com/v1/news/headlines',
  weatherApiKey: import.meta.env['WEATHER_API_KEY'] ,
  weatherApiUrl: 'https://www.meteosource.com/api/v1/free',
  googleSheetsApiKey: import.meta.env['GOOGLE_SHEETS_API_KEY'],
  googleClientId: import.meta.env['NG_APP_GOOGLE_CLIENT_ID'],
  googleClientSecret: import.meta.env['NG_APP_GOOGLE_CLIENT_SECRET'],
  googleAppsScriptUrl: import.meta.env['GOOGLE_APPS_SCRIPT_URL'],
};

