interface ImportMetaEnv {
  readonly NG_APP_GOOGLE_CLIENT_ID: string;
  readonly NG_APP_GOOGLE_SHEETS_API_KEY: string;
  readonly NG_APP_GOOGLE_APPS_SCRIPT_URL: string;
  readonly NG_APP_GOOGLE_BUSINESS_APPS_SCRIPT_URL: string;
  readonly NG_APP_GOOGLE_FEEDING_APPS_SCRIPT_URL: string;
  readonly NG_APP_GOOGLE_FEEDING_SHEET_ID: string;
  readonly NG_APP_ENABLE_EXPLORER: string;
  readonly NG_APP_APPS_SCRIPT_MODE: string;
  readonly NG_APP_GOOGLE_BUSINESS_SHEET_ID: string;
  readonly NG_APP_GOOGLE_EXPENSE_SHEET_ID: string;
  readonly NG_APP_HUGGINGFACE_TOKEN: string;
  /** Set to "true" to enable the Explorer/Documents tab in the Feeding app.
   *  When absent or any other value, the tab is hidden and no Drive API calls are made. */
  readonly NG_APP_ENABLE_EXPLORER: string;
  /** Controls how the app reaches Google Apps Script.
   *  "direct" → call the Apps Script exec URL directly from the browser (no Vercel proxy).
   *  Any other value / absent → use the Vercel /api/* proxy functions (default, CORS-safe). */
  readonly NG_APP_APPS_SCRIPT_MODE: string;

  // ── HuggingFace chat assistant (Trợ lý AI) ──
  /** Inference Endpoint URL. Empty → chat assistant disabled. */
  readonly NG_APP_HF_INFERENCE_URL: string;
  /** HF API token. For production, inject via a server proxy and leave this empty. */
  readonly NG_APP_HF_API_TOKEN: string;
  /** HF chat model id (used when endpoint is the public router). */
  readonly NG_APP_HF_MODEL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
