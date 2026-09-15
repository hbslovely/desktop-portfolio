import { Type } from '@angular/core';

export type AppWindowLoader = () => Promise<Type<unknown>>;

/** Lazy loaders for desktop window apps — keeps initial bundle smaller. */
export const APP_WINDOW_LOADERS: Record<string, AppWindowLoader> = {
  'my-info': () =>
    import('../components/apps/iframe-app/iframe-app.component').then((m) => m.IframeAppComponent),
  love: () =>
    import('../components/apps/love-app/love-app.component').then((m) => m.LoveAppComponent),
  explorer: () =>
    import('../components/apps/explorer/explorer.component').then((m) => m.ExplorerComponent),
  'text-viewer': () =>
    import('../components/apps/text-viewer/text-viewer.component').then(
      (m) => m.TextViewerComponent
    ),
  'image-viewer': () =>
    import('../components/apps/image-viewer/image-viewer.component').then(
      (m) => m.ImageViewerComponent
    ),
  'pdf-viewer': () =>
    import('../components/apps/pdf-viewer/pdf-viewer.component').then((m) => m.PdfViewerComponent),
  settings: () =>
    import('../components/apps/settings-app/settings-app.component').then(
      (m) => m.SettingsAppComponent
    ),
  expense: () => import('@hbslovely/expense').then((m) => m.ExpenseAppComponent),
  business: () =>
    import('../components/apps/business-app/business-app.component').then(
      (m) => m.BusinessAppComponent
    ),
  'chinese-chess': () =>
    import('../components/apps/chinese-chess-app/chinese-chess-app.component').then(
      (m) => m.ChineseChessAppComponent
    ),
  'fb-id-finder': () =>
    import('../components/apps/fb-id-finder-app/fb-id-finder-app.component').then(
      (m) => m.FbIdFinderAppComponent
    ),
};
