import { InjectionToken } from '@angular/core';

/** Display name shown in About (feeding app). */
export const APP_NAME = 'Bé yêu';

/**
 * Application version — keep in sync with package.json "version".
 * Updated automatically by GitHub release workflows.
 */
export const APP_VERSION = '2026.06.1-rc.04';

export interface AppInfo {
  name: string;
  version: string;
}

export const APP_INFO: AppInfo = {
  name: APP_NAME,
  version: APP_VERSION,
};

export const APP_INFO_TOKEN = new InjectionToken<AppInfo>('APP_INFO');
