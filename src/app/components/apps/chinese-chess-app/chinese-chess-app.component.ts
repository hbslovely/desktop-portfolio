import { Component, OnInit, inject } from '@angular/core';

import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-chinese-chess-app',
  standalone: true,
  imports: [],
  templateUrl: './chinese-chess-app.component.html',
  styleUrl: './chinese-chess-app.component.scss',
})
export class ChineseChessAppComponent implements OnInit {
  private sanitizer = inject(DomSanitizer);

  gameUrl: SafeResourceUrl;

  constructor() {
    // Load the index.html file from the assets
    const url = 'assets/chinese-chess/index.html';
    this.gameUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  ngOnInit() {
    // Component initialization
  }
}
