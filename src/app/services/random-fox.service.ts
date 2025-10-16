import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface RandomFox {
  image: string;
  link: string;
}

@Injectable({
  providedIn: 'root'
})
export class RandomFoxService {
  private apiUrl = 'https://randomfox.ca/floof/';

  constructor(private http: HttpClient) {}

  /**
   * Get a random fox image
   * Based on: https://randomfox.ca/floof/
   * Returns: {"image":"https://randomfox.ca/images/8.jpg","link":"https://randomfox.ca/?i=8"}
   */
  getRandomFox(): Observable<RandomFox> {
    return this.http.get<RandomFox>(this.apiUrl).pipe(
      catchError(error => {

        // Return fallback image
        return of({
          image: 'https://randomfox.ca/images/1.jpg',
          link: 'https://randomfox.ca/?i=1'
        } as RandomFox);
      })
    );
  }

  /**
   * Get multiple random fox images
   */
  async getMultipleFoxes(count: number = 1): Promise<RandomFox[]> {
    const foxes: RandomFox[] = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const fox = await this.getRandomFox().toPromise();
        if (fox) {
          foxes.push(fox);
        }
      } catch (error) {

      }
    }
    
    return foxes;
  }
}

