import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { SwapiService, Starship } from './swapi.service';
import { describe, beforeEach, afterEach, it, expect } from 'vitest';

describe('SwapiService', () => {
  let service: SwapiService;
  let httpMock: HttpTestingController;

  const mockStarships: Starship[] = [
    {
      name: 'CR90 corvette',
      model: 'CR90 corvette',
      manufacturer: 'Corellian Engineering Corporation',
      cost_in_credits: '3500000',
      length: '150',
      max_atmosphering_speed: '950',
      crew: '30-165',
      passengers: '600',
      cargo_capacity: '3000000',
      consumables: '1 year',
      hyperdrive_rating: '2.0',
      MGLT: '60',
      starship_class: 'corvette',
      url: 'https://swapi.dev/api/starships/2/'
    },
    {
      name: 'Death Star',
      model: 'DS-1 Orbital Battle Station',
      manufacturer: 'Imperial Department of Military Research',
      cost_in_credits: '1000000000000',
      length: '120000',
      max_atmosphering_speed: 'n/a',
      crew: '342953',
      passengers: '843342',
      cargo_capacity: '1000000000000',
      consumables: '3 years',
      hyperdrive_rating: '4.0',
      MGLT: '10',
      starship_class: 'Deep Space Mobile Battlestation',
      url: 'https://swapi.dev/api/starships/9/'
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SwapiService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(SwapiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch starships array and return formatted paginated response', () => {
    service.getStarships(1).subscribe(data => {
      expect(data.count).toBe(2);
      expect(data.results.length).toBe(2);
      expect(data.results[0].name).toBe('CR90 corvette');
      expect(data.next).toBeNull();
    });

    const req = httpMock.expectOne('https://swapi.dev/api/starships');
    expect(req.request.method).toBe('GET');
    req.flush(mockStarships);
  });

  it('should filter starships locally by search query', () => {
    service.getStarships(1, 'Death').subscribe(data => {
      expect(data.count).toBe(1);
      expect(data.results.length).toBe(1);
      expect(data.results[0].name).toBe('Death Star');
    });

    const req = httpMock.expectOne('https://swapi.dev/api/starships');
    req.flush(mockStarships);
  });

  it('should cache consecutive requests for same page/query', () => {
    // First call - triggers HTTP
    service.getStarships(1).subscribe();
    const req = httpMock.expectOne('https://swapi.dev/api/starships');
    req.flush(mockStarships);

    // Second call - should return cached value synchronously, no HTTP request made
    let receivedData = false;
    service.getStarships(1).subscribe(data => {
      expect(data.results[0].name).toBe('CR90 corvette');
      receivedData = true;
    });

    expect(receivedData).toBe(true);
  });
});
