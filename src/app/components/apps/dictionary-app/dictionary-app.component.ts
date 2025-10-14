import { Component, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface Phonetic {
  text: string;
  audio?: string;
}

interface Definition {
  definition: string;
  example?: string;
  synonyms: string[];
  antonyms: string[];
}

interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
  synonyms?: string[];
  antonyms?: string[];
}

interface WordData {
  word: string;
  phonetic?: string;
  phonetics: Phonetic[];
  origin?: string;
  meanings: Meaning[];
}

@Component({
  selector: 'app-dictionary-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dictionary-app.component.html',
  styleUrl: './dictionary-app.component.scss'
})
export class DictionaryAppComponent implements AfterViewInit {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  private readonly API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

  searchTerm = signal<string>('');
  wordData = signal<WordData | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  searchHistory = signal<string[]>([]);
  currentAudio = signal<HTMLAudioElement | null>(null);

  // Popular words to suggest
  popularWords = [
    'serendipity', 'ephemeral', 'eloquent', 'resilient',
    'paradigm', 'ubiquitous', 'innovation', 'perspective',
    'integrity', 'wisdom', 'courage', 'harmony'
  ];

  constructor(private http: HttpClient) {
    this.loadSearchHistory();
  }

  ngAfterViewInit() {
    // Auto-focus search input
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
    }, 100);
  }

  searchWord(word?: string) {
    const searchWord = word || this.searchTerm();
    if (!searchWord || searchWord.trim().length === 0) {
      return;
    }

    const trimmedWord = searchWord.trim().toLowerCase();
    this.loading.set(true);
    this.error.set(null);
    this.wordData.set(null);

    this.http.get<WordData[]>(`${this.API_URL}${trimmedWord}`).subscribe({
      next: (response) => {
        if (response && response.length > 0) {
          this.wordData.set(response[0]);
          this.addToHistory(trimmedWord);
          this.loading.set(false);
        }
      },
      error: (err) => {
        console.error('Dictionary API error:', err);
        if (err.status === 404) {
          this.error.set(`No definition found for "${trimmedWord}". Please check the spelling.`);
        } else {
          this.error.set('Failed to fetch word definition. Please try again.');
        }
        this.loading.set(false);
      }
    });
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.searchWord();
    }
  }

  clearSearch() {
    this.searchTerm.set('');
    this.wordData.set(null);
    this.error.set(null);
    this.searchInput?.nativeElement?.focus();
  }

  playAudio(audioUrl: string) {
    // Stop current audio if playing
    const current = this.currentAudio();
    if (current) {
      current.pause();
      current.currentTime = 0;
    }

    // Create and play new audio
    const audio = new Audio(audioUrl.startsWith('//') ? 'https:' + audioUrl : audioUrl);
    this.currentAudio.set(audio);
    
    audio.play().catch(err => {
      console.error('Audio playback error:', err);
    });

    audio.onended = () => {
      this.currentAudio.set(null);
    };
  }

  searchFromHistory(word: string) {
    this.searchTerm.set(word);
    this.searchWord(word);
  }

  searchSuggestion(word: string) {
    this.searchTerm.set(word);
    this.searchWord(word);
  }

  clearHistory() {
    this.searchHistory.set([]);
    localStorage.removeItem('dictionary-search-history');
  }

  private addToHistory(word: string) {
    const history = this.searchHistory();
    const updatedHistory = [word, ...history.filter(w => w !== word)].slice(0, 10);
    this.searchHistory.set(updatedHistory);
    localStorage.setItem('dictionary-search-history', JSON.stringify(updatedHistory));
  }

  private loadSearchHistory() {
    const stored = localStorage.getItem('dictionary-search-history');
    if (stored) {
      try {
        const history = JSON.parse(stored);
        this.searchHistory.set(history);
      } catch (err) {
        console.error('Error loading search history:', err);
      }
    }
  }

  getAllSynonyms(): string[] {
    const data = this.wordData();
    if (!data) return [];

    const synonyms = new Set<string>();
    data.meanings.forEach(meaning => {
      meaning.definitions.forEach(def => {
        def.synonyms.forEach(syn => synonyms.add(syn));
      });
      if (meaning.synonyms) {
        meaning.synonyms.forEach(syn => synonyms.add(syn));
      }
    });

    return Array.from(synonyms);
  }

  getAllAntonyms(): string[] {
    const data = this.wordData();
    if (!data) return [];

    const antonyms = new Set<string>();
    data.meanings.forEach(meaning => {
      meaning.definitions.forEach(def => {
        def.antonyms.forEach(ant => antonyms.add(ant));
      });
      if (meaning.antonyms) {
        meaning.antonyms.forEach(ant => antonyms.add(ant));
      }
    });

    return Array.from(antonyms);
  }

  getPhoneticWithAudio(): Phonetic | null {
    const data = this.wordData();
    if (!data) return null;

    return data.phonetics.find(p => p.audio && p.audio.length > 0) || null;
  }
}

