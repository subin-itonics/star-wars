import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

export interface Starship {
  name: string;
  model: string;
  manufacturer: string;
  cost_in_credits: string;
  length: string;
  max_atmosphering_speed: string;
  crew: string;
  passengers: string;
  cargo_capacity: string;
  consumables: string;
  hyperdrive_rating: string;
  MGLT: string;
  starship_class: string;
  url: string;
}

export interface SwapiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Starship[];
}

@Injectable({
  providedIn: 'root'
})
export class SwapiService {
  private http = inject(HttpClient);
  private baseUrl = 'https://swapi.info/api/starships';

  // Cache the full array of starships once fetched from swapi.info
  private allStarships: Starship[] | null = null;

  getStarships(page: number = 1, search: string = ''): Observable<SwapiResponse> {
    if (this.allStarships) {
      return of(this.processLocalData(this.allStarships, page, search));
    }

    return this.http.get<Starship[]>(this.baseUrl).pipe(
      tap(data => {
        this.allStarships = data;
      }),
      map(data => {
        return this.processLocalData(data, page, search);
      }),
      catchError(error => {
        console.error('SWAPI fetch error:', error);
        return throwError(() => new Error(error.message || 'Failed to fetch starships from Star Wars API.'));
      })
    );
  }

  /**
   * Helper to perform client-side filtering and pagination matching SwapiResponse structure
   */
  private processLocalData(starships: Starship[], page: number, search: string): SwapiResponse {
    let filtered = starships;
    if (search.trim()) {
      const query = search.toLowerCase().trim();
      filtered = starships.filter(ship => 
        ship.name.toLowerCase().includes(query) || 
        ship.model.toLowerCase().includes(query)
      );
    }

    const pageSize = 10;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const sliced = filtered.slice(startIndex, endIndex);

    const hasNext = endIndex < filtered.length;
    const nextUrl = hasNext ? `mock-next-page?page=${page + 1}` : null;
    const prevUrl = page > 1 ? `mock-prev-page?page=${page - 1}` : null;

    return {
      count: filtered.length,
      next: nextUrl,
      previous: prevUrl,
      results: sliced
    };
  }

  /**
   * Helper to clear cache if needed
   */
  clearCache(): void {
    this.allStarships = null;
  }
}
