export const environment = {
  production: true,
  newsApiToken: process.env['NEWS_API_TOKEN'] || '',
  newsApiUrl: 'https://api.thenewsapi.com/v1/news/headlines',
  weatherApiKey: process.env['WEATHER_API_KEY'] || '14jfr08k0k8gugbc5uws1qapmur5udxejwzlirrd',
  weatherApiUrl: 'https://www.meteosource.com/api/v1/free'
};

