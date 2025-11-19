interface ImportMetaEnv {
  readonly NG_APP_WEATHER_API_KEY: string;
  readonly NG_APP_GOOGLE_CLIENT_ID: string;
  readonly WEATHER_API_KEY: string;
  readonly GOOGLE_SHEETS_API_KEY: string;
  readonly NG_APP_GOOGLE_CLIENT_SECRET: string;
  readonly GOOGLE_APPS_SCRIPT_URL: string;
  readonly NEWS_API_TOKEN: string;
  // thêm các env khác bạn cần
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
