interface ImportMetaEnv {
  readonly NG_APP_GOOGLE_CLIENT_ID: string;
  readonly NG_APP_WEATHER_API_KEY: string;
  readonly NG_APP_GOOGLE_SHEETS_API_KEY: string;
  readonly NG_APP_GOOGLE_APPS_SCRIPT_URL: string;
  readonly NG_APP_GOOGLE_BUSINESS_APPS_SCRIPT_URL: string;
  readonly NG_APP_GOOGLE_FEEDING_APPS_SCRIPT_URL: string;
  readonly NG_APP_GOOGLE_FEEDING_SHEET_ID: string;
  readonly NG_APP_GOOGLE_BUSINESS_SHEET_ID: string;
  readonly NG_APP_GOOGLE_EXPENSE_SHEET_ID: string;
  readonly NG_APP_HUGGINGFACE_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
