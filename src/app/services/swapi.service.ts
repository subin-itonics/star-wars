import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

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
  private readonly baseUrl = 'https://swapi.dev/api/starships/';

  /** In-memory cache: key = "<page>:<search>" → cached response */
  private cache = new Map<string, SwapiResponse>();

  private cacheKey(page: number, search: string): string {
    return `${page}:${search.trim()}`;
  }

  /**
   * Fetches a page of starships from the real SWAPI API.
   * Both `page` and `search` are forwarded as native API query params
   * so pagination and filtering happen server-side.
   *
   * Results are cached in memory so the same page is never re-fetched.
   */
  getStarships(page: number = 1, search: string = ''): Observable<SwapiResponse> {
    const key = this.cacheKey(page, search);
    const cached = this.cache.get(key);
    if (cached) {
      return of(cached);
    }

    let params = new HttpParams().set('page', page.toString());
    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<SwapiResponse>(this.baseUrl, { params }).pipe(
      tap(response => this.cache.set(key, response)),
      catchError(error => {
        console.error('SWAPI fetch error:', error);
        return throwError(() => new Error(error.message || 'Failed to fetch starships from Star Wars API.'));
      })
    );
  }

  /**
   * Evicts cached entries for a given search query (or all entries if no
   * search is provided).  Call this when the user changes the search term
   * so stale results don't leak across queries.
   */
  clearCache(search?: string): void {
    if (search === undefined) {
      this.cache.clear();
    } else {
      const suffix = `:${search.trim()}`;
      for (const key of this.cache.keys()) {
        if (key.endsWith(suffix)) this.cache.delete(key);
      }
    }
  }
}
