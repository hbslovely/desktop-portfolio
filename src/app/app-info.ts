/** Display name shown in About (feeding app). */
export const APP_NAME = 'Baby Lovely Data Storage';

/**
 * Application version — keep in sync with package.json "version".
 * Scheme: YYYY.MM (monthly), YYYY.MM.N (daily patch), <base>-rc.NN (commit RC).
 * Updated automatically by GitHub release workflows.
 */
export const APP_VERSION = '2026.08.8-rc.01';

export interface AppInfo {
  name: string;
  version: string;
}

export const APP_INFO: AppInfo = {
  name: APP_NAME,
  version: APP_VERSION,
};
