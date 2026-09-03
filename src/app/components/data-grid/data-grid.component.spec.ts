import { TestBed, ComponentFixture } from '@angular/core/testing';
import { DataGridComponent } from './data-grid.component';
import { SwapiService, SwapiResponse } from '../../services/swapi.service';
import { DataStateService } from '../../services/data-state.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('DataGridComponent', () => {
  let component: DataGridComponent;
  let fixture: ComponentFixture<DataGridComponent>;
  let swapiServiceMock: any;
  let dataStateService: DataStateService;

  const mockStarships: SwapiResponse = {
    count: 1,
    next: null,
    previous: null,
    results: [
      {
        name: 'Millennium Falcon',
        model: 'YT-1300 light freighter',
        manufacturer: 'Corellian Engineering Corporation',
        cost_in_credits: '100000',
        length: '34.37',
        max_atmosphering_speed: '1050',
        crew: '4',
        passengers: '6',
        cargo_capacity: '100000',
        consumables: '2 months',
        hyperdrive_rating: '0.5',
        MGLT: '75',
        starship_class: 'Light freighter',
        url: 'https://swapi.dev/api/starships/10/'
      }
    ]
  };

  beforeEach(async () => {
    class MockIntersectionObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    swapiServiceMock = {
      getStarships: vi.fn().mockReturnValue(of(mockStarships)),
      clearCache: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DataGridComponent],
      providers: [
        { provide: SwapiService, useValue: swapiServiceMock },
        DataStateService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DataGridComponent);
    component = fixture.componentInstance;
    dataStateService = TestBed.inject(DataStateService);
    dataStateService.clearEdits();
    fixture.detectChanges();
  });

  it('should create and load initial starship data', () => {
    expect(component).toBeTruthy();
    expect(swapiServiceMock.getStarships).toHaveBeenCalledWith(1, '');
    expect(component.starships().length).toBe(1);
    expect(component.starships()[0].name).toBe('Millennium Falcon');
  });

  it('should activate editing mode when startEdit is called on an editable column', () => {
    const falcon = component.starships()[0];

    component.startEdit(falcon.url, 'crew', falcon.crew);

    expect(component.editingCell()).toEqual({ url: falcon.url, columnId: 'crew' });
    expect(component.editValue()).toBe('4');
  });

  it('should not allow editing non-editable columns', () => {
    const falcon = component.starships()[0];

    component.startEdit(falcon.url, 'name', falcon.name);

    expect(component.editingCell()).toBeNull();
  });

  it('should apply and merge local edits in the table data', () => {
    const falcon = component.starships()[0];

    dataStateService.updateStarship(falcon.url, 'crew', '10');
    fixture.detectChanges();

    const updatedFalcon = component.processedStarships()[0];
    expect(updatedFalcon.crew).toBe('10');
    expect(updatedFalcon.name).toBe('Millennium Falcon');
  });

  it('should cancel edit and clear editing state on Escape', () => {
    const falcon = component.starships()[0];

    component.startEdit(falcon.url, 'crew', falcon.crew);
    expect(component.editingCell()).not.toBeNull();

    component.cancelEdit();
    expect(component.editingCell()).toBeNull();
  });

  it('should correctly identify editable columns', () => {
    expect(component.isEditableColumn('crew')).toBe(true);
    expect(component.isEditableColumn('passengers')).toBe(true);
    expect(component.isEditableColumn('name')).toBe(false);
    expect(component.isEditableColumn('model')).toBe(false);
  });
});
