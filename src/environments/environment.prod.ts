export const environment = {
  production: true,
  newsApiToken: process.env['NEWS_API_TOKEN'] || '',
  newsApiUrl: 'https://api.thenewsapi.com/v1/news/headlines',
  weatherApiKey: process.env['WEATHER_API_KEY'] ,
  weatherApiUrl: 'https://www.meteosource.com/api/v1/free',
  googleSheetsApiKey: process.env['GOOGLE_SHEETS_API_KEY'],
  googleClientId: process.env['NG_APP_GOOGLE_CLIENT_ID'],
  googleClientSecret: process.env['NG_APP_GOOGLE_CLIENT_SECRET'],
  googleAppsScriptUrl: process.env['GOOGLE_APPS_SCRIPT_URL'],
};

