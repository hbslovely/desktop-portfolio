import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-chinese-chess-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chinese-chess-app.component.html',
  styleUrl: './chinese-chess-app.component.scss'
})
export class ChineseChessAppComponent implements OnInit {
  gameUrl: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer) {
    // Load the index.html file from the assets
    const url = 'assets/chinese-chess/index.html';
    this.gameUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  ngOnInit() {
    // Component initialization
  }
}

