import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface CatFact {
  _id: string;
  text: string;
  type?: string;
  updatedAt?: string;
  deleted?: boolean;
  source?: string;
  sentCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CatFactsService {
  private apiUrl = 'https://cat-fact.herokuapp.com';

  constructor(private http: HttpClient) {}

  /**
   * Get random cat facts
   * Based on: https://alexwohlbruck.github.io/cat-facts/docs/endpoints/facts.html
   * @param amount Number of facts to retrieve (default: 1, max: 500)
   * @param animalType Type of animal (default: 'cat')
   */
  getRandomFacts(amount: number = 1, animalType: string = 'cat'): Observable<CatFact | CatFact[]> {
    const params = new HttpParams()
      .set('animal_type', animalType)
      .set('amount', amount.toString());

    return this.http.get<CatFact | CatFact[]>(`${this.apiUrl}/facts/random`, { params }).pipe(
      catchError(error => {
        console.error('Cat Facts API error:', error);
        // Return fallback fact
        return of({
          _id: 'fallback',
          text: 'Cats spend 70% of their lives sleeping, which means a nine-year-old cat has been awake for only three years of its life.',
          type: 'cat'
        } as CatFact);
      })
    );
  }

  /**
   * Get a single random cat fact
   */
  getSingleRandomFact(animalType: string = 'cat'): Observable<CatFact> {
    return this.getRandomFacts(1, animalType).pipe(
      map(result => Array.isArray(result) ? result[0] : result)
    );
  }

  /**
   * Get fact by ID
   */
  getFactById(factId: string): Observable<CatFact> {
    return this.http.get<CatFact>(`${this.apiUrl}/facts/${factId}`).pipe(
      catchError(error => {
        console.error('Cat Fact by ID error:', error);
        return of({
          _id: factId,
          text: 'Unable to load this fact.',
          type: 'cat'
        } as CatFact);
      })
    );
  }
}

