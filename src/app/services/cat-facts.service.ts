import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface CatFact {
  _id?: string;
  text: string;
  type?: string;
  updatedAt?: string;
  deleted?: boolean;
  source?: string;
  sentCount?: number;
}

export interface MeowFactsResponse {
  data: string[];
}

@Injectable({
  providedIn: 'root'
})
export class CatFactsService {
  private apiUrl = 'https://meowfacts.herokuapp.com';

  constructor(private http: HttpClient) {}

  /**
   * Get random cat facts from MeowFacts API
   * Based on: https://meowfacts.herokuapp.com/
   * @param count Number of facts to retrieve (default: 1)
   */
  getRandomFacts(count: number = 1): Observable<CatFact[]> {
    return this.http.get<MeowFactsResponse>(`${this.apiUrl}/?count=${count}`).pipe(
      map(response => {
        // Convert string array to CatFact array
        return response.data.map((fact, index) => ({
          _id: `meow-${Date.now()}-${index}`,
          text: fact,
          type: 'cat',
          source: 'meowfacts'
        } as CatFact));
      }),
      catchError(error => {

        // Return fallback fact
        return of([{
          _id: 'fallback',
          text: 'Cats spend 70% of their lives sleeping, which means a nine-year-old cat has been awake for only three years of its life.',
          type: 'cat',
          source: 'fallback'
        } as CatFact]);
      })
    );
  }

  /**
   * Get a single random cat fact
   */
  getSingleRandomFact(): Observable<CatFact> {
    return this.getRandomFacts(1).pipe(
      map(facts => facts[0])
    );
  }

  /**
   * Get multiple cat facts at once
   */
  getMultipleFacts(count: number = 3): Observable<CatFact[]> {
    return this.getRandomFacts(count);
  }
}

