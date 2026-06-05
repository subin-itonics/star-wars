import { Injectable, signal } from '@angular/core';
import { Starship } from './swapi.service';

@Injectable({
  providedIn: 'root'
})
export class DataStateService {
  // Store edits as an object mapping starship url -> partial starship edits
  private edits = signal<Record<string, Partial<Starship>>>({});

  getEdits() {
    return this.edits.asReadonly();
  }

  /**
   * Update a starship's property locally.
   * This is designed to be easily swappable with a real backend PUT/PATCH API call.
   */
  updateStarship(url: string, field: keyof Starship, value: string): void {
    console.log(`State update triggered: updating starship [${url}] property [${field}] to value [${value}]`);
    
    // BACKEND INTEGRATION PLACEHOLDER:
    // If we wanted to write this to an API, we would perform:
    // this.http.patch(`/api/starships/${id}`, { [field]: value }).subscribe(...)
    
    this.edits.update(currentEdits => {
      const starshipEdits = currentEdits[url] || {};
      return {
        ...currentEdits,
        [url]: {
          ...starshipEdits,
          [field]: value
        }
      };
    });
  }

  /**
   * Merge fetched starships with any active client-side edits
   */
  mergeWithEdits(starships: Starship[]): Starship[] {
    const currentEdits = this.edits();
    return starships.map(ship => {
      const shipEdits = currentEdits[ship.url];
      if (shipEdits) {
        return {
          ...ship,
          ...shipEdits
        };
      }
      return ship;
    });
  }

  /**
   * Reset all edits back to original API values
   */
  clearEdits(): void {
    this.edits.set({});
  }
}
