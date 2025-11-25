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
  styleUrl: './dictionary-app.component.scss',
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
  bookmarkedWords = signal<string[]>([]);
  wordOfTheDay = signal<string>('');
  showCopyNotification = signal(false);
  showBookmarkNotification = signal(false);

  // Popular words to suggest
  popularWords = [
    'serendipity', 'ephemeral', 'eloquent', 'resilient',
    'paradigm', 'ubiquitous', 'innovation', 'perspective',
    'integrity', 'wisdom', 'courage', 'harmony'
  ];

  // Word of the Day list
  wordOfTheDayList = [
    'serendipity', 'ephemeral', 'eloquent', 'resilient', 'paradigm',
    'ubiquitous', 'innovation', 'perspective', 'integrity', 'wisdom',
    'courage', 'harmony', 'magnificent', 'extraordinary', 'brilliant',
    'wonderful', 'remarkable', 'exceptional', 'outstanding', 'phenomenal',
    'splendid', 'marvelous', 'fantastic', 'incredible', 'amazing',
    'beautiful', 'elegant', 'graceful', 'sophisticated', 'refined'
  ];

  constructor(private http: HttpClient) {
    this.loadSearchHistory();
    this.loadBookmarks();
    this.setWordOfTheDay();
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

  // Bookmark functionality
  isBookmarked(word: string): boolean {
    return this.bookmarkedWords().includes(word.toLowerCase());
  }

  toggleBookmark(word: string) {
    const wordLower = word.toLowerCase();
    const bookmarks = this.bookmarkedWords();
    
    if (this.isBookmarked(wordLower)) {
      const updated = bookmarks.filter(w => w !== wordLower);
      this.bookmarkedWords.set(updated);
      this.saveBookmarks(updated);
    } else {
      const updated = [...bookmarks, wordLower];
      this.bookmarkedWords.set(updated);
      this.saveBookmarks(updated);
      this.showBookmarkNotification.set(true);
      setTimeout(() => this.showBookmarkNotification.set(false), 2000);
    }
  }

  private loadBookmarks() {
    const stored = localStorage.getItem('dictionary-bookmarks');
    if (stored) {
      try {
        const bookmarks = JSON.parse(stored);
        this.bookmarkedWords.set(bookmarks);
      } catch (err) {
        // Ignore parse errors
      }
    }
  }

  private saveBookmarks(bookmarks: string[]) {
    localStorage.setItem('dictionary-bookmarks', JSON.stringify(bookmarks));
  }

  removeBookmark(word: string) {
    const updated = this.bookmarkedWords().filter(w => w !== word.toLowerCase());
    this.bookmarkedWords.set(updated);
    this.saveBookmarks(updated);
  }

  // Word of the Day
  setWordOfTheDay() {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    const wordIndex = dayOfYear % this.wordOfTheDayList.length;
    this.wordOfTheDay.set(this.wordOfTheDayList[wordIndex]);
  }

  searchWordOfTheDay() {
    this.searchTerm.set(this.wordOfTheDay());
    this.searchWord(this.wordOfTheDay());
  }

  // Copy definition to clipboard
  copyDefinition() {
    const data = this.wordData();
    if (!data) return;

    let text = `📖 ${data.word}\n\n`;
    
    if (data.phonetic) {
      text += `Pronunciation: ${data.phonetic}\n\n`;
    }

    if (data.origin) {
      text += `Origin: ${data.origin}\n\n`;
    }

    data.meanings.forEach((meaning, i) => {
      text += `${meaning.partOfSpeech.toUpperCase()}\n`;
      meaning.definitions.forEach((def, j) => {
        text += `${j + 1}. ${def.definition}\n`;
        if (def.example) {
          text += `   Example: "${def.example}"\n`;
        }
      });
      text += '\n';
    });

    if (this.getAllSynonyms().length > 0) {
      text += `Synonyms: ${this.getAllSynonyms().join(', ')}\n`;
    }

    if (this.getAllAntonyms().length > 0) {
      text += `Antonyms: ${this.getAllAntonyms().join(', ')}\n`;
    }

    navigator.clipboard.writeText(text).then(() => {
      this.showCopyNotification.set(true);
      setTimeout(() => this.showCopyNotification.set(false), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  // Share definition
  shareDefinition() {
    const data = this.wordData();
    if (!data) return;

    const text = `Check out the definition of "${data.word}" in the Dictionary app!`;
    const url = window.location.href;

    if (navigator.share) {
      navigator.share({
        title: `Definition: ${data.word}`,
        text: text,
        url: url
      }).catch(err => {
        console.error('Error sharing:', err);
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${text}\n${url}`).then(() => {
        this.showCopyNotification.set(true);
        setTimeout(() => this.showCopyNotification.set(false), 2000);
      });
    }
  }

  // Export definition as text file
  exportDefinition() {
    const data = this.wordData();
    if (!data) return;

    let text = `Dictionary Definition\n`;
    text += `===================\n\n`;
    text += `Word: ${data.word}\n`;
    
    if (data.phonetic) {
      text += `Pronunciation: ${data.phonetic}\n`;
    }

    if (data.origin) {
      text += `Origin: ${data.origin}\n`;
    }

    text += `\nDefinitions:\n`;
    text += `------------\n\n`;

    data.meanings.forEach((meaning, i) => {
      text += `${meaning.partOfSpeech.toUpperCase()}\n`;
      meaning.definitions.forEach((def, j) => {
        text += `${j + 1}. ${def.definition}\n`;
        if (def.example) {
          text += `   Example: "${def.example}"\n`;
        }
      });
      text += '\n';
    });

    if (this.getAllSynonyms().length > 0) {
      text += `Synonyms: ${this.getAllSynonyms().join(', ')}\n\n`;
    }

    if (this.getAllAntonyms().length > 0) {
      text += `Antonyms: ${this.getAllAntonyms().join(', ')}\n\n`;
    }

    text += `\nExported on: ${new Date().toLocaleString()}\n`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.word}-definition.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
