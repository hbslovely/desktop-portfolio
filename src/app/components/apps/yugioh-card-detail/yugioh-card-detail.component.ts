import { Component, OnInit, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { YugiohService, YugiohCard } from '../../../services/yugioh.service';

@Component({
  selector: 'app-yugioh-card-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './yugioh-card-detail.component.html',
  styleUrl: './yugioh-card-detail.component.scss'
})
export class YugiohCardDetailComponent implements OnInit {
  @Input() cardId?: number;
  @Input() cardName?: string;
  
  card = signal<YugiohCard | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  selectedImageSize = signal<'normal' | 'small' | 'cropped'>('normal');
  
  // Computed values
  hasMultipleImages = computed(() => {
    const cardData = this.card();
    return cardData && cardData.card_images && cardData.card_images.length > 1;
  });
  
  currentImageIndex = signal(0);
  
  currentImage = computed(() => {
    const cardData = this.card();
    if (!cardData || !cardData.card_images || cardData.card_images.length === 0) {
      return null;
    }
    return cardData.card_images[this.currentImageIndex()];
  });

  constructor(private yugiohService: YugiohService) {}

  ngOnInit() {
    this.loadCardDetail();
  }

  loadCardDetail() {
    this.isLoading.set(true);
    this.error.set(null);

    // Fetch by ID or name
    if (this.cardId) {
      this.yugiohService.getCardById(this.cardId).subscribe({
        next: (card) => {
          if (card) {
            this.card.set(card);
          } else {
            this.error.set('Card not found');
          }
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error loading card:', err);
          this.error.set('Failed to load card details');
          this.isLoading.set(false);
        }
      });
    } else if (this.cardName) {
      this.yugiohService.getCardByName(this.cardName).subscribe({
        next: (card) => {
          if (card) {
            this.card.set(card);
          } else {
            this.error.set('Card not found');
          }
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error loading card:', err);
          this.error.set('Failed to load card details');
          this.isLoading.set(false);
        }
      });
    } else {
      this.error.set('No card ID or name provided');
      this.isLoading.set(false);
    }
  }

  getCardImageUrl(size: 'normal' | 'small' | 'cropped' = 'normal'): string {
    const img = this.currentImage();
    if (!img) return '';
    return this.yugiohService.getCardImageUrl(img.id, size);
  }

  nextImage() {
    const cardData = this.card();
    if (!cardData || !cardData.card_images) return;
    
    const maxIndex = cardData.card_images.length - 1;
    if (this.currentImageIndex() < maxIndex) {
      this.currentImageIndex.update(i => i + 1);
    }
  }

  prevImage() {
    if (this.currentImageIndex() > 0) {
      this.currentImageIndex.update(i => i - 1);
    }
  }

  setImageSize(size: 'normal' | 'small' | 'cropped') {
    this.selectedImageSize.set(size);
  }

  getAttributeIcon(attribute?: string): string {
    if (!attribute) return '';
    const icons: { [key: string]: string } = {
      'DARK': '🌑',
      'LIGHT': '☀️',
      'EARTH': '🌍',
      'WATER': '💧',
      'FIRE': '🔥',
      'WIND': '💨',
      'DIVINE': '✨'
    };
    return icons[attribute.toUpperCase()] || '';
  }

  getFrameTypeClass(frameType: string): string {
    return `frame-${frameType.toLowerCase().replace(/\s+/g, '-')}`;
  }

  formatPrice(price: string | undefined): string {
    if (!price || price === '0' || price === '0.00') return 'N/A';
    return `$${parseFloat(price).toFixed(2)}`;
  }

  openYgoprodeckPage() {
    const cardData = this.card();
    if (cardData && cardData.ygoprodeck_url) {
      window.open(cardData.ygoprodeck_url, '_blank');
    }
  }
}

