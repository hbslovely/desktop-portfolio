interface ImportMetaEnv {
  readonly NG_APP_GOOGLE_CLIENT_ID: string;
  readonly NG_APP_WEATHER_API_KEY: string;
  readonly NG_APP_GOOGLE_SHEETS_API_KEY: string;
  readonly NG_APP_GOOGLE_CLIENT_SECRET: string;
  readonly NG_APP_GOOGLE_APPS_SCRIPT_URL: string;
  readonly NG_APP_NEWS_API_TOKEN: string;
  readonly NG_APP_GOOGLE_BUSINESS_APPS_SCRIPT_URL: string;
  readonly NG_APP_SECURITIES_SHEET_SCRIPT_ID: string;
  // thêm các env khác bạn cần
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
