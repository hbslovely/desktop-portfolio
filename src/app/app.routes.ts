import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'boi-vui',
    loadComponent: () => import('./pages/boi-vui/boi-vui.component').then(m => m.BoiVuiComponent),
    title: 'Bói Vui'
  },
  {
    path: 'chat',
    loadComponent: () => import('./pages/chat/chat.component').then(m => m.ChatComponent),
    title: 'Video Chat - WebRTC'
  },
  {
    path: 'hello-2026',
    loadComponent: () => import('./pages/hello-2026/hello-2026.component').then(m => m.Hello2026Component),
    title: 'Vòng Quay Tết 2026'
  },
  {
    path: 'ten-cua-boi-2026',
    loadComponent: () => import('./pages/ten-cua-boi-2026/ten-cua-boi-2026.component').then(m => m.TenCuaBoi2026Component),
    title: 'Tên của Bối'
  },
  {
    path: 'pit',
    loadComponent: () => import('./pages/pit-2026/pit-2026.component').then(m => m.Pit2026Component),
    title: 'Công cụ tính thuế TNCN 2026'
  },
  {
    path: 'tax',
    loadComponent: () => import('./pages/pit-2026/pit-2026.component').then(m => m.Pit2026Component),
    title: 'Công cụ tính thuế TNCN 2026'
  }
];
