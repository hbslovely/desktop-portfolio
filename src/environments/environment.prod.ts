export const environment = {
  production: true,
  newsApiToken: process.env['NEWS_API_TOKEN'] || '',
  newsApiUrl: 'https://api.thenewsapi.com/v1/news/headlines'
};

