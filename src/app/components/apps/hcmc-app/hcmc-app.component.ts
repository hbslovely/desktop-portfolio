import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Attraction {
  id: string;
  name: string;
  description: string;
  image: string;
  category: 'landmark' | 'culture' | 'food' | 'entertainment' | 'shopping';
  rating: number;
  location: string;
}

interface FoodItem {
  id: string;
  name: string;
  description: string;
  image: string;
  price: string;
  category: 'street-food' | 'restaurant' | 'dessert' | 'drink';
}

@Component({
  selector: 'app-hcmc-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hcmc-app.component.html',
  styleUrl: './hcmc-app.component.scss'
})
export class HcmcAppComponent {
  // Navigation
  activeTab = signal<string>('overview');
  
  // City data
  cityInfo = {
    name: 'Ho Chi Minh City',
    vietnameseName: 'Thành phố Hồ Chí Minh',
    nickname: 'Saigon',
    population: '9.3 million',
    area: '2,095 km²',
    established: '1698',
    timeZone: 'ICT (UTC+7)',
    currency: 'Vietnamese Dong (VND)',
    language: 'Vietnamese',
    climate: 'Tropical monsoon climate'
  };

  // Attractions data
  attractions = signal<Attraction[]>([
    {
      id: 'ben-thanh-market',
      name: 'Ben Thanh Market',
      description: 'The most famous market in Ho Chi Minh City, offering everything from fresh produce to souvenirs.',
      image: 'assets/images/hcmc/ben-thanh-market.jpg',
      category: 'shopping',
      rating: 4.2,
      location: 'District 1'
    },
    {
      id: 'notre-dame-cathedral',
      name: 'Notre-Dame Cathedral Basilica of Saigon',
      description: 'A beautiful French colonial cathedral built in the 19th century with distinctive red brick facade.',
      image: 'assets/images/hcmc/notre-dame.jpg',
      category: 'landmark',
      rating: 4.5,
      location: 'District 1'
    },
    {
      id: 'central-post-office',
      name: 'Central Post Office',
      description: 'Historic post office designed by Gustave Eiffel, featuring beautiful French colonial architecture.',
      image: 'assets/images/hcmc/post-office.jpg',
      category: 'landmark',
      rating: 4.3,
      location: 'District 1'
    },
    {
      id: 'war-remnants-museum',
      name: 'War Remnants Museum',
      description: 'A powerful museum documenting the Vietnam War with exhibits and artifacts.',
      image: 'assets/images/hcmc/war-museum.jpg',
      category: 'culture',
      rating: 4.4,
      location: 'District 3'
    },
    {
      id: 'cu-chi-tunnels',
      name: 'Cu Chi Tunnels',
      description: 'Underground tunnel network used during the Vietnam War, now a popular tourist attraction.',
      image: 'assets/images/hcmc/cu-chi-tunnels.jpg',
      category: 'culture',
      rating: 4.6,
      location: 'Cu Chi District'
    },
    {
      id: 'bui-vien-street',
      name: 'Bui Vien Walking Street',
      description: 'Famous backpacker street with bars, restaurants, and vibrant nightlife.',
      image: 'assets/images/hcmc/bui-vien.jpg',
      category: 'entertainment',
      rating: 4.1,
      location: 'District 1'
    }
  ]);

  // Food data
  foods = signal<FoodItem[]>([
    {
      id: 'pho',
      name: 'Phở',
      description: 'Traditional Vietnamese noodle soup with beef or chicken, herbs, and rice noodles.',
      image: 'assets/images/hcmc/pho.jpg',
      price: '30,000 - 80,000 VND',
      category: 'street-food'
    },
    {
      id: 'banh-mi',
      name: 'Bánh Mì',
      description: 'Vietnamese sandwich with various fillings like pork, pate, vegetables, and herbs.',
      image: 'assets/images/hcmc/banh-mi.jpg',
      price: '15,000 - 40,000 VND',
      category: 'street-food'
    },
    {
      id: 'com-tam',
      name: 'Cơm Tấm',
      description: 'Broken rice with grilled pork, pickled vegetables, and fish sauce.',
      image: 'assets/images/hcmc/com-tam.jpg',
      price: '25,000 - 60,000 VND',
      category: 'street-food'
    },
    {
      id: 'banh-xeo',
      name: 'Bánh Xèo',
      description: 'Vietnamese crispy crepe filled with shrimp, pork, and bean sprouts.',
      image: 'assets/images/hcmc/banh-xeo.jpg',
      price: '40,000 - 80,000 VND',
      category: 'street-food'
    },
    {
      id: 'ca-phe-sua-da',
      name: 'Cà Phê Sữa Đá',
      description: 'Traditional Vietnamese iced coffee with condensed milk.',
      image: 'assets/images/hcmc/ca-phe.jpg',
      price: '15,000 - 30,000 VND',
      category: 'drink'
    },
    {
      id: 'che',
      name: 'Chè',
      description: 'Vietnamese sweet dessert soup with various ingredients like beans, fruits, and coconut milk.',
      image: 'assets/images/hcmc/che.jpg',
      price: '20,000 - 40,000 VND',
      category: 'dessert'
    }
  ]);

  // Computed properties
  filteredAttractions = computed(() => {
    const category = this.selectedCategory();
    if (category === 'all') {
      return this.attractions();
    }
    return this.attractions().filter(attraction => attraction.category === category);
  });

  selectedCategory = signal<string>('all');
  searchQuery = signal<string>('');

  // Methods
  setActiveTab(tab: string) {
    this.activeTab.set(tab);
  }

  setCategory(category: string) {
    this.selectedCategory.set(category);
  }

  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'all': 'pi pi-globe',
      'landmark': 'pi pi-map-marker',
      'culture': 'pi pi-book',
      'food': 'pi pi-apple',
      'entertainment': 'pi pi-star',
      'shopping': 'pi pi-shopping-bag'
    };
    return icons[category] || 'pi pi-circle';
  }

  getCategoryColor(category: string): string {
    const colors: { [key: string]: string } = {
      'all': '#007bff',
      'landmark': '#28a745',
      'culture': '#dc3545',
      'food': '#ffc107',
      'entertainment': '#6f42c1',
      'shopping': '#fd7e14'
    };
    return colors[category] || '#6c757d';
  }

  getFoodCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'street-food': 'pi pi-apple',
      'restaurant': 'pi pi-home',
      'dessert': 'pi pi-heart',
      'drink': 'pi pi-coffee'
    };
    return icons[category] || 'pi pi-circle';
  }

  formatPrice(price: string): string {
    return price;
  }

  getStarRating(rating: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i < Math.floor(rating) ? 1 : 0);
  }

  getTabIcon(tab: string): string {
    const icons: { [key: string]: string } = {
      'overview': 'pi pi-home',
      'attractions': 'pi pi-map-marker',
      'food': 'pi pi-apple',
      'explore': 'pi pi-compass'
    };
    return icons[tab] || 'pi pi-circle';
  }

  getTabLabel(tab: string): string {
    const labels: { [key: string]: string } = {
      'overview': 'Overview',
      'attractions': 'Attractions',
      'food': 'Food',
      'explore': 'Explore'
    };
    return labels[tab] || tab;
  }

  getCategoryLabel(category: string): string {
    const labels: { [key: string]: string } = {
      'all': 'All',
      'landmark': 'Landmarks',
      'culture': 'Culture',
      'food': 'Food',
      'entertainment': 'Entertainment',
      'shopping': 'Shopping'
    };
    return labels[category] || category;
  }

  getFoodCategoryLabel(category: string): string {
    const labels: { [key: string]: string } = {
      'street-food': 'Street Food',
      'restaurant': 'Restaurant',
      'dessert': 'Dessert',
      'drink': 'Drink'
    };
    return labels[category] || category;
  }

  onImageError(event: Event) {
    const target = event.target as HTMLImageElement;
    target.src = 'assets/images/placeholder.jpg';
  }
}
