import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface ShopCategory {
  id: string;
  name: string;
  icon: string;
}

interface QuickService {
  label: string;
  icon: string;
  tone: string;
}

interface MallItem {
  title: string;
  subtitle: string;
  image: string;
}

interface ShopProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  originalPrice: number;
  rating: number;
  sold: number;
  location: string;
  badge: string;
  image: string;
  shipping: string;
}

interface CartItem extends ShopProduct {
  quantity: number;
}

@Component({
  selector: 'app-shop-clone-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shop-clone-app.component.html',
  styleUrl: './shop-clone-app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopCloneAppComponent {
  searchTerm = signal('');
  selectedCategory = signal('all');
  selectedSort = signal<'popular' | 'price-asc' | 'price-desc' | 'sold'>('popular');
  cart = signal<CartItem[]>([]);

  readonly hotKeywords = [
    'dép nữ',
    'áo khoác',
    'tai nghe bluetooth',
    'son tint',
    'ốp điện thoại',
    'đèn ngủ',
    'bánh tráng',
    'túi tote'
  ];

  readonly quickServices: QuickService[] = [
    { label: 'Khung Giờ Săn Sale', icon: 'pi pi-clock', tone: 'orange' },
    { label: 'Miễn Phí Vận Chuyển', icon: 'pi pi-truck', tone: 'green' },
    { label: 'Voucher Giảm Đến 50%', icon: 'pi pi-ticket', tone: 'purple' },
    { label: 'Hàng Hiệu Outlet', icon: 'pi pi-star', tone: 'red' },
    { label: 'Nạp Thẻ & Dịch Vụ', icon: 'pi pi-wallet', tone: 'blue' },
    { label: 'Gì Cũng Rẻ', icon: 'pi pi-tags', tone: 'yellow' },
    { label: 'Mall Chính Hãng', icon: 'pi pi-verified', tone: 'pink' },
    { label: 'Shopee Live', icon: 'pi pi-video', tone: 'orange' },
    { label: 'Shopee Food', icon: 'pi pi-shopping-bag', tone: 'green' },
    { label: 'Hàng Quốc Tế', icon: 'pi pi-globe', tone: 'blue' }
  ];

  readonly categories: ShopCategory[] = [
    { id: 'all', name: 'Tất cả', icon: 'pi pi-th-large' },
    { id: 'fashion', name: 'Thời Trang Nam', icon: 'pi pi-user' },
    { id: 'fashion', name: 'Thời Trang Nữ', icon: 'pi pi-heart' },
    { id: 'electronics', name: 'Điện Thoại & Phụ Kiện', icon: 'pi pi-mobile' },
    { id: 'electronics', name: 'Thiết Bị Điện Tử', icon: 'pi pi-desktop' },
    { id: 'home', name: 'Nhà Cửa & Đời Sống', icon: 'pi pi-home' },
    { id: 'beauty', name: 'Sắc Đẹp', icon: 'pi pi-sparkles' },
    { id: 'food', name: 'Bách Hóa Online', icon: 'pi pi-shopping-bag' },
    { id: 'sports', name: 'Thể Thao & Du Lịch', icon: 'pi pi-compass' },
    { id: 'mom', name: 'Mẹ & Bé', icon: 'pi pi-gift' }
  ];

  readonly mallItems: MallItem[] = [
    { title: 'Deli', subtitle: 'Mua 1 tặng 1', image: 'DL' },
    { title: 'La Roche-Posay', subtitle: 'Mua là có quà', image: 'LR' },
    { title: 'Samsung', subtitle: 'Giảm đến 40%', image: 'SS' },
    { title: 'Lifebuoy', subtitle: 'Mua 2 giảm 10%', image: 'LB' },
    { title: 'Maybelline', subtitle: 'Deal từ 99K', image: 'MB' },
    { title: 'LocknLock', subtitle: 'Ưu đãi độc quyền', image: 'LL' }
  ];

  readonly products: ShopProduct[] = [
    { id: 1, name: 'Áo thun oversize cotton basic nhiều màu, form rộng unisex', category: 'fashion', price: 99000, originalPrice: 189000, rating: 4.8, sold: 12500, location: 'TP. Hồ Chí Minh', badge: 'Mall', image: 'AT', shipping: 'Freeship' },
    { id: 2, name: 'Tai nghe bluetooth chống ồn pin 32 giờ, bảo hành 12 tháng', category: 'electronics', price: 349000, originalPrice: 699000, rating: 4.7, sold: 8300, location: 'Hà Nội', badge: 'Yêu thích', image: 'TN', shipping: 'Hỏa tốc' },
    { id: 3, name: 'Serum dưỡng sáng da vitamin C 30ml, hỗ trợ đều màu da', category: 'beauty', price: 159000, originalPrice: 299000, rating: 4.9, sold: 21100, location: 'Đà Nẵng', badge: 'Sale', image: 'VC', shipping: 'Freeship' },
    { id: 4, name: 'Kệ để bàn gỗ mini phong cách tối giản, lắp ráp dễ dàng', category: 'home', price: 129000, originalPrice: 220000, rating: 4.6, sold: 4600, location: 'Bình Dương', badge: 'Top', image: 'KG', shipping: 'Freeship' },
    { id: 5, name: 'Combo snack rong biển và hạt dinh dưỡng ăn vặt văn phòng', category: 'food', price: 79000, originalPrice: 135000, rating: 4.8, sold: 17400, location: 'Đồng Nai', badge: 'Deal sốc', image: 'SN', shipping: 'Freeship' },
    { id: 6, name: 'Váy midi hoa nhí dáng xòe đi chơi, chất voan mềm nhẹ', category: 'fashion', price: 219000, originalPrice: 399000, rating: 4.7, sold: 6800, location: 'TP. Hồ Chí Minh', badge: 'Hot', image: 'VM', shipping: 'Hỏa tốc' },
    { id: 7, name: 'Đèn ngủ cảm ứng ánh sáng ấm, sạc USB, decor phòng ngủ', category: 'home', price: 89000, originalPrice: 159000, rating: 4.5, sold: 3900, location: 'Hà Nội', badge: 'New', image: 'DN', shipping: 'Freeship' },
    { id: 8, name: 'Bàn phím cơ không dây layout 84 phím, switch êm, RGB', category: 'electronics', price: 599000, originalPrice: 990000, rating: 4.9, sold: 5200, location: 'TP. Hồ Chí Minh', badge: 'Mall', image: 'BP', shipping: 'Freeship' },
    { id: 9, name: 'Set quần áo thể thao nam nữ co giãn, thấm hút mồ hôi', category: 'sports', price: 179000, originalPrice: 320000, rating: 4.6, sold: 2800, location: 'Cần Thơ', badge: 'Rẻ vô địch', image: 'TT', shipping: 'Freeship' },
    { id: 10, name: 'Bộ bình sữa silicon cho bé, chống đầy hơi, dễ vệ sinh', category: 'mom', price: 245000, originalPrice: 420000, rating: 4.8, sold: 7200, location: 'Hà Nội', badge: 'Mall', image: 'BB', shipping: 'Freeship' }
  ];

  filteredProducts = computed(() => {
    const term = this.normalize(this.searchTerm());
    const category = this.selectedCategory();
    const sort = this.selectedSort();

    const result = this.products.filter(product => {
      const matchesCategory = category === 'all' || product.category === category;
      const matchesSearch = !term || this.normalize(product.name).includes(term);
      return matchesCategory && matchesSearch;
    });

    return [...result].sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      if (sort === 'sold') return b.sold - a.sold;
      return b.rating - a.rating;
    });
  });

  cartTotal = computed(() => this.cart().reduce((total, item) => total + item.price * item.quantity, 0));

  cartCount = computed(() => this.cart().reduce((total, item) => total + item.quantity, 0));

  featuredDeals = computed(() => this.products.slice(0, 6));

  setCategory(categoryId: string): void {
    this.selectedCategory.set(categoryId);
  }

  setKeyword(keyword: string): void {
    this.searchTerm.set(keyword);
  }

  setSort(sort: 'popular' | 'price-asc' | 'price-desc' | 'sold'): void {
    this.selectedSort.set(sort);
  }

  addToCart(product: ShopProduct): void {
    this.cart.update(items => {
      const existing = items.find(item => item.id === product.id);
      if (existing) {
        return items.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...items, { ...product, quantity: 1 }];
    });
  }

  removeFromCart(productId: number): void {
    this.cart.update(items => items.filter(item => item.id !== productId));
  }

  clearCart(): void {
    this.cart.set([]);
  }

  discountPercent(product: ShopProduct): number {
    return Math.round((1 - product.price / product.originalPrice) * 100);
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(value);
  }

  formatSold(value: number): string {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
    }
    return value.toString();
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');
  }
}
