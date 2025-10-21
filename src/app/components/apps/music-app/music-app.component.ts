import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface MusicVideo {
  id: string;
  title: string;
  artist: string;
  youtubeId: string;
  thumbnail: string;
  category: string;
  duration: string;
  playlist?: string;
  liked?: boolean;
}

interface Playlist {
  id: string;
  name: string;
  icon: string;
  count: number;
}

@Component({
  selector: 'app-music-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './music-app.component.html',
  styleUrl: './music-app.component.scss'
})
export class MusicAppComponent implements OnInit {
  // State
  currentVideo = signal<MusicVideo | null>(null);
  musicLibrary = signal<MusicVideo[]>([]);
  selectedCategory = signal<string>('all');
  selectedPlaylist = signal<string>('all');
  searchQuery = signal<string>('');
  viewMode = signal<'grid' | 'list' | 'compact'>('grid');
  isShuffleOn = signal<boolean>(false);
  isRepeatOn = signal<boolean>(false);
  showPlaylists = signal<boolean>(true);

  // Categories
  categories = [
    { value: 'all', label: 'All Music', icon: 'pi-music' },
    { value: 'pop', label: 'Pop', icon: 'pi-star' },
    { value: 'rock', label: 'Rock', icon: 'pi-bolt' },
    { value: 'jazz', label: 'Jazz', icon: 'pi-palette' },
    { value: 'classical', label: 'Classical', icon: 'pi-crown' },
    { value: 'electronic', label: 'Electronic', icon: 'pi-desktop' },
    { value: 'vietnamese', label: 'Vietnamese', icon: 'pi-heart' }
  ];

  // Playlists
  playlists = computed<Playlist[]>(() => {
    const library = this.musicLibrary();
    return [
      { id: 'all', name: 'All Songs', icon: 'pi-list', count: library.length },
      { id: 'liked', name: 'Liked Songs', icon: 'pi-heart-fill', count: library.filter(v => v.liked).length },
      { id: 'international', name: 'International', icon: 'pi-globe', count: library.filter(v => v.playlist === 'international').length },
      { id: 'vietnamese', name: 'Việt Nam', icon: 'pi-flag', count: library.filter(v => v.playlist === 'vietnamese').length },
      { id: 'recent', name: 'Recently Played', icon: 'pi-clock', count: Math.min(10, library.length) }
    ];
  });

  // Computed filtered videos
  filteredVideos = computed(() => {
    let videos = this.musicLibrary();
    
    // Filter by playlist
    const playlist = this.selectedPlaylist();
    if (playlist === 'liked') {
      videos = videos.filter(v => v.liked);
    } else if (playlist === 'international') {
      videos = videos.filter(v => v.playlist === 'international');
    } else if (playlist === 'vietnamese') {
      videos = videos.filter(v => v.playlist === 'vietnamese');
    } else if (playlist === 'recent') {
      videos = videos.slice(0, 10);
    }
    
    // Filter by category
    if (this.selectedCategory() !== 'all') {
      videos = videos.filter(v => v.category === this.selectedCategory());
    }
    
    // Filter by search query
    const query = this.searchQuery().toLowerCase();
    if (query) {
      videos = videos.filter(v => 
        v.title.toLowerCase().includes(query) ||
        v.artist.toLowerCase().includes(query) ||
        (v.category && v.category.toLowerCase().includes(query))
      );
    }
    
    // Shuffle if enabled
    if (this.isShuffleOn()) {
      videos = [...videos].sort(() => Math.random() - 0.5);
    }
    
    return videos;
  });

  // Search results count
  searchResultsCount = computed(() => {
    return this.filteredVideos().length;
  });

  // Computed safe URL for YouTube iframe
  safeVideoUrl = computed(() => {
    const video = this.currentVideo();
    if (!video) return null;
    
    const url = `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.loadMusicLibrary();
  }

  /**
   * Load music library (sample data)
   */
  loadMusicLibrary(): void {
    const library: MusicVideo[] = [
      // International Songs
      {
        id: '1',
        title: 'Shape of You',
        artist: 'Ed Sheeran',
        youtubeId: 'JGwWNGJdvx8',
        thumbnail: 'https://img.youtube.com/vi/JGwWNGJdvx8/mqdefault.jpg',
        category: 'pop',
        duration: '3:53',
        playlist: 'international',
        liked: true
      },
      {
        id: '2',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        youtubeId: 'fJ9rUzIMcZQ',
        thumbnail: 'https://img.youtube.com/vi/fJ9rUzIMcZQ/mqdefault.jpg',
        category: 'rock',
        duration: '5:55',
        playlist: 'international',
        liked: true
      },
      {
        id: '3',
        title: 'Take Five',
        artist: 'Dave Brubeck',
        youtubeId: 'vmDDOFXSgAs',
        thumbnail: 'https://img.youtube.com/vi/vmDDOFXSgAs/mqdefault.jpg',
        category: 'jazz',
        duration: '5:24',
        playlist: 'international'
      },
      {
        id: '4',
        title: 'Clair de Lune',
        artist: 'Claude Debussy',
        youtubeId: 'CvFH_6DNRCY',
        thumbnail: 'https://img.youtube.com/vi/CvFH_6DNRCY/mqdefault.jpg',
        category: 'classical',
        duration: '5:20',
        playlist: 'international'
      },
      {
        id: '5',
        title: 'Strobe',
        artist: 'Deadmau5',
        youtubeId: 'tKi9Z-f6qX4',
        thumbnail: 'https://img.youtube.com/vi/tKi9Z-f6qX4/mqdefault.jpg',
        category: 'electronic',
        duration: '10:37',
        playlist: 'international'
      },
      {
        id: '6',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        youtubeId: '4NRXx6U8ABQ',
        thumbnail: 'https://img.youtube.com/vi/4NRXx6U8ABQ/mqdefault.jpg',
        category: 'pop',
        duration: '3:20',
        playlist: 'international',
        liked: true
      },
      {
        id: '7',
        title: 'Stairway to Heaven',
        artist: 'Led Zeppelin',
        youtubeId: 'QkF3oxziUI4',
        thumbnail: 'https://img.youtube.com/vi/QkF3oxziUI4/mqdefault.jpg',
        category: 'rock',
        duration: '8:02',
        playlist: 'international'
      },
      {
        id: '8',
        title: 'So What',
        artist: 'Miles Davis',
        youtubeId: 'zqNTltOGh5c',
        thumbnail: 'https://img.youtube.com/vi/zqNTltOGh5c/mqdefault.jpg',
        category: 'jazz',
        duration: '9:22',
        playlist: 'international'
      },
      {
        id: '9',
        title: 'Symphony No. 5',
        artist: 'Beethoven',
        youtubeId: '_4IRMYuE1hI',
        thumbnail: 'https://img.youtube.com/vi/_4IRMYuE1hI/mqdefault.jpg',
        category: 'classical',
        duration: '7:29',
        playlist: 'international'
      },
      {
        id: '10',
        title: 'Levels',
        artist: 'Avicii',
        youtubeId: '_ovdm2yX4MA',
        thumbnail: 'https://img.youtube.com/vi/_ovdm2yX4MA/mqdefault.jpg',
        category: 'electronic',
        duration: '3:18',
        playlist: 'international'
      },
      {
        id: '11',
        title: 'Watermelon Sugar',
        artist: 'Harry Styles',
        youtubeId: 'E07s5ZYygMg',
        thumbnail: 'https://img.youtube.com/vi/E07s5ZYygMg/mqdefault.jpg',
        category: 'pop',
        duration: '2:54',
        playlist: 'international'
      },
      {
        id: '12',
        title: 'Hotel California',
        artist: 'Eagles',
        youtubeId: '09839DpTctU',
        thumbnail: 'https://img.youtube.com/vi/09839DpTctU/mqdefault.jpg',
        category: 'rock',
        duration: '6:30',
        playlist: 'international'
      },
      // Vietnamese Songs
      {
        id: '13',
        title: 'Lạc Trôi',
        artist: 'Sơn Tùng M-TP',
        youtubeId: 'DrY_K0mT-zk',
        thumbnail: 'https://img.youtube.com/vi/DrY_K0mT-zk/mqdefault.jpg',
        category: 'vietnamese',
        duration: '4:01',
        playlist: 'vietnamese',
        liked: true
      },
      {
        id: '14',
        title: 'Chạy Ngay Đi',
        artist: 'Sơn Tùng M-TP',
        youtubeId: 'JDXz0CXUHcI',
        thumbnail: 'https://img.youtube.com/vi/JDXz0CXUHcI/mqdefault.jpg',
        category: 'vietnamese',
        duration: '4:28',
        playlist: 'vietnamese',
        liked: true
      },
      {
        id: '15',
        title: 'Sóng Gió',
        artist: 'K-ICM ft. Jack',
        youtubeId: 'fafYDUBKhJo',
        thumbnail: 'https://img.youtube.com/vi/fafYDUBKhJo/mqdefault.jpg',
        category: 'vietnamese',
        duration: '4:58',
        playlist: 'vietnamese'
      },
      {
        id: '16',
        title: 'Hãy Trao Cho Anh',
        artist: 'Sơn Tùng M-TP ft. Snoop Dogg',
        youtubeId: 'knW7-x7Y7RE',
        thumbnail: 'https://img.youtube.com/vi/knW7-x7Y7RE/mqdefault.jpg',
        category: 'vietnamese',
        duration: '3:50',
        playlist: 'vietnamese',
        liked: true
      },
      {
        id: '17',
        title: 'Một Nhà',
        artist: 'Da LAB',
        youtubeId: 'gEGy8EeSDBo',
        thumbnail: 'https://img.youtube.com/vi/gEGy8EeSDBo/mqdefault.jpg',
        category: 'vietnamese',
        duration: '4:15',
        playlist: 'vietnamese'
      },
      {
        id: '18',
        title: 'Có Chắc Yêu Là Đây',
        artist: 'Sơn Tùng M-TP',
        youtubeId: 'FN7ALfpGxiI',
        thumbnail: 'https://img.youtube.com/vi/FN7ALfpGxiI/mqdefault.jpg',
        category: 'vietnamese',
        duration: '4:51',
        playlist: 'vietnamese'
      },
      {
        id: '19',
        title: 'Bống Bống Bang Bang',
        artist: '911 Band',
        youtubeId: 'pqLvFfwcqfw',
        thumbnail: 'https://img.youtube.com/vi/pqLvFfwcqfw/mqdefault.jpg',
        category: 'vietnamese',
        duration: '5:04',
        playlist: 'vietnamese'
      },
      {
        id: '20',
        title: 'Nơi Này Có Anh',
        artist: 'Sơn Tùng M-TP',
        youtubeId: '7DFXQ9u2xj8',
        thumbnail: 'https://img.youtube.com/vi/7DFXQ9u2xj8/mqdefault.jpg',
        category: 'vietnamese',
        duration: '4:38',
        playlist: 'vietnamese',
        liked: true
      }
    ];

    this.musicLibrary.set(library);
    
    // Auto-play first video
    if (library.length > 0) {
      this.currentVideo.set(library[0]);
    }
  }

  /**
   * Play video
   */
  playVideo(video: MusicVideo): void {
    this.currentVideo.set(video);
  }

  /**
   * Change category
   */
  changeCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  /**
   * Change view mode
   */
  changeViewMode(mode: 'grid' | 'list' | 'compact'): void {
    this.viewMode.set(mode);
  }

  /**
   * Clear search
   */
  clearSearch(): void {
    this.searchQuery.set('');
  }

  /**
   * Change playlist
   */
  changePlaylist(playlistId: string): void {
    this.selectedPlaylist.set(playlistId);
  }

  /**
   * Toggle shuffle
   */
  toggleShuffle(): void {
    this.isShuffleOn.set(!this.isShuffleOn());
  }

  /**
   * Toggle repeat
   */
  toggleRepeat(): void {
    this.isRepeatOn.set(!this.isRepeatOn());
  }

  /**
   * Toggle like on video
   */
  toggleLike(videoId: string): void {
    this.musicLibrary.update(library => 
      library.map(v => 
        v.id === videoId ? { ...v, liked: !v.liked } : v
      )
    );
  }

  /**
   * Toggle playlists sidebar
   */
  togglePlaylists(): void {
    this.showPlaylists.set(!this.showPlaylists());
  }

  /**
   * Play next video
   */
  playNext(): void {
    const current = this.currentVideo();
    if (!current) return;

    const filtered = this.filteredVideos();
    const currentIndex = filtered.findIndex(v => v.id === current.id);
    
    if (currentIndex < filtered.length - 1) {
      this.currentVideo.set(filtered[currentIndex + 1]);
    } else {
      // If repeat is on, loop to first; otherwise stop
      if (this.isRepeatOn()) {
        this.currentVideo.set(filtered[0]);
      }
    }
  }

  /**
   * Play previous video
   */
  playPrevious(): void {
    const current = this.currentVideo();
    if (!current) return;

    const filtered = this.filteredVideos();
    const currentIndex = filtered.findIndex(v => v.id === current.id);
    
    if (currentIndex > 0) {
      this.currentVideo.set(filtered[currentIndex - 1]);
    } else {
      // If repeat is on, loop to last; otherwise stop
      if (this.isRepeatOn()) {
        this.currentVideo.set(filtered[filtered.length - 1]);
      }
    }
  }

  /**
   * Get current video liked status
   */
  isCurrentVideoLiked(): boolean {
    const current = this.currentVideo();
    return current?.liked || false;
  }
}

