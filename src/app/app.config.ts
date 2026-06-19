import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { APP_INFO_TOKEN, provideFeedingConfig } from '@hbslovely/baby-feeding';

import { routes } from './app.routes';
import { APP_INFO } from './app-info';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    { provide: APP_INFO_TOKEN, useValue: APP_INFO },
    provideFeedingConfig({
      googleFeedingSheetId: environment.googleFeedingSheetId,
      googleSheetsApiKey: environment.googleSheetsApiKey,
      googleFeedingAppsScriptUrl: environment.googleFeedingAppsScriptUrl,
      googleClientId: environment.googleClientId,
      enableExplorer: environment.enableExplorer,
      appsScriptDirect: environment.appsScriptDirect,
    }),
  ],
};
