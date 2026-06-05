import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { SwapiService } from './services/swapi.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('App', () => {
  beforeEach(async () => {
    const swapiServiceMock = {
      getStarships: vi.fn().mockReturnValue(of({ count: 0, next: null, previous: null, results: [] })),
      clearCache: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: SwapiService, useValue: swapiServiceMock },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
