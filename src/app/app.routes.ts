import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'chat',
    loadComponent: () => import('./pages/chat/chat.component').then(m => m.ChatComponent),
    title: 'Video Chat - WebRTC'
  },
  {
    path: 'hello-2026',
    loadComponent: () => import('./pages/hello-2026/hello-2026.component').then(m => m.Hello2026Component),
    title: 'Vòng Quay Tết 2026'
  }
];
