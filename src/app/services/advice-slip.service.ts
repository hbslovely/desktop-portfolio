import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

export interface AdviceSlip {
  id: number;
  advice: string;
}

interface AdviceSlipResponse {
  slip: {
    slip_id: string;
    advice: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AdviceSlipService {
  private readonly API_URL = 'https://api.adviceslip.com/advice';

  constructor(private http: HttpClient) {}

  /**
   * Get a random advice slip
   * Note: Advice is cached for 2 seconds by the API
   */
  getRandomAdvice(): Observable<AdviceSlip> {
    return this.http.get<AdviceSlipResponse>(this.API_URL).pipe(
      map(response => ({
        id: parseInt(response.slip.slip_id, 10),
        advice: response.slip.advice
      })),
      catchError(error => {

        // Return a default advice if API fails
        return of({
          id: 0,
          advice: 'Believe in yourself and all that you are.'
        });
      })
    );
  }

  /**
   * Get advice by specific ID
   */
  getAdviceById(id: number): Observable<AdviceSlip> {
    return this.http.get<AdviceSlipResponse>(`${this.API_URL}/${id}`).pipe(
      map(response => ({
        id: parseInt(response.slip.slip_id, 10),
        advice: response.slip.advice
      })),
      catchError(error => {

        return of({
          id: 0,
          advice: 'Believe in yourself and all that you are.'
        });
      })
    );
  }
}

