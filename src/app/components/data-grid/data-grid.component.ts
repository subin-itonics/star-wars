import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  HostListener,
  signal,
  computed,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  createAngularTable,
  getCoreRowModel,
  ColumnDef,
  ColumnPinningState,
} from '@tanstack/angular-table';
import { SwapiService, Starship } from '../../services/swapi.service';
import { DataStateService } from '../../services/data-state.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  rowUrl: string | null;
  rowData: Starship | null;
  columnId: string | null;
}

@Component({
  selector: 'app-data-grid',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './data-grid.component.html',
  styleUrls: []
})
export class DataGridComponent implements OnInit, AfterViewInit, OnDestroy {
  private swapiService = inject(SwapiService);
  private dataStateService = inject(DataStateService);

  @ViewChild('scrollAnchor') scrollAnchor!: ElementRef<HTMLDivElement>;
  @ViewChild('tableContainer') tableContainer!: ElementRef<HTMLDivElement>;

  // Data & pagination
  starships = signal<Starship[]>([]);
  searchQuery = signal<string>('');
  currentPage = signal<number>(1);
  hasNextPage = signal<boolean>(true);
  isInitialLoading = signal<boolean>(true);
  isBackgroundLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  /** Atomic guard — set to true as the very first thing in fetchNextPage. */
  private isFetching = false;

  // Cell editing
  editingCell = signal<{ url: string; columnId: keyof Starship } | null>(null);
  editValue = signal<string>('');

  // Row selection — Set of starship URLs
  selectedRows = signal<Set<string>>(new Set());

  // Column pinning state
  columnPinning = signal<ColumnPinningState>({ left: ['select'], right: [] });

  // Context menu
  contextMenu = signal<ContextMenuState>({
    visible: false, x: 0, y: 0,
    rowUrl: null, rowData: null, columnId: null
  });

  private searchSubject = new Subject<string>();
  private subscriptions: Subscription[] = [];
  private observer: IntersectionObserver | null = null;

  localEdits = this.dataStateService.getEdits();

  processedStarships = computed(() => this.dataStateService.mergeWithEdits(this.starships()));

  allSelected = computed(() => {
    const rows = this.processedStarships();
    if (rows.length === 0) return false;
    return rows.every(r => this.selectedRows().has(r.url));
  });

  someSelected = computed(() => {
    const rows = this.processedStarships();
    return rows.some(r => this.selectedRows().has(r.url)) && !this.allSelected();
  });

  selectedCount = computed(() => this.selectedRows().size);

  // Per-column metadata: icon path + label
  readonly columnMeta: Record<string, { label: string; icon: string }> = {
    name: {
      label: 'Name',
      icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z'
    },
    model: {
      label: 'Model',
      icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z M15 12a3 3 0 11-6 0 3 3 0 016 0z'
    },
    manufacturer: {
      label: 'Manufacturer',
      icon: 'M3.75 21V6.75A2.25 2.25 0 016 4.5h12A2.25 2.25 0 0120.25 6.75V21M3.75 21h16.5M3.75 21H2.25m18 0h1.5M9 9.75h6M9 13.5h6M9 17.25h6M6.75 9.75h.008v.008H6.75V9.75zm0 3.75h.008v.008H6.75v-.008zm0 3.75h.008v.008H6.75V17.25z'
    },
    starship_class: {
      label: 'Class',
      icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z'
    },
    crew: {
      label: 'Crew',
      icon: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z'
    },
    passengers: {
      label: 'Passengers',
      icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z'
    },
    hyperdrive_rating: {
      label: 'Hyperdrive',
      icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z'
    },
    cost_in_credits: {
      label: 'Cost',
      icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    length: {
      label: 'Length (m)',
      icon: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5'
    },
    max_atmosphering_speed: {
      label: 'Max Speed',
      icon: 'M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z'
    },
    MGLT: {
      label: 'MGLT',
      icon: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5'
    },
    cargo_capacity: {
      label: 'Cargo',
      icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z'
    },
  };

  columns: ColumnDef<Starship>[] = [
    {
      id: 'select',
      header: '',
      size: 48,
      minSize: 48,
      enableResizing: false,
      enablePinning: true,
      cell: (info) => info.row.index + 1,
    },
    {
      accessorKey: 'name',
      header: 'Name',
      size: 200,
      minSize: 100,
    },
    {
      accessorKey: 'model',
      header: 'Model',
      size: 220,
      minSize: 100,
    },
    {
      accessorKey: 'manufacturer',
      header: 'Manufacturer',
      size: 220,
      minSize: 100,
    },
    {
      accessorKey: 'starship_class',
      header: 'Class',
      size: 160,
      minSize: 80,
    },
    {
      accessorKey: 'crew',
      header: 'Crew',
      size: 110,
      minSize: 70,
    },
    {
      accessorKey: 'passengers',
      header: 'Passengers',
      size: 120,
      minSize: 80,
    },
    {
      accessorKey: 'hyperdrive_rating',
      header: 'Hyperdrive',
      size: 110,
      minSize: 80,
    },
    {
      accessorKey: 'cost_in_credits',
      header: 'Cost',
      size: 140,
      minSize: 90,
    },
    {
      accessorKey: 'length',
      header: 'Length (m)',
      size: 110,
      minSize: 70,
    },
    {
      accessorKey: 'max_atmosphering_speed',
      header: 'Max Speed',
      size: 120,
      minSize: 80,
    },
    {
      accessorKey: 'MGLT',
      header: 'MGLT',
      size: 80,
      minSize: 60,
    },
    {
      accessorKey: 'cargo_capacity',
      header: 'Cargo',
      size: 140,
      minSize: 80,
    },
  ];

  tableInstance = createAngularTable(() => ({
    data: this.processedStarships(),
    columns: this.columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange' as const,
    enableColumnResizing: true,
    enableColumnPinning: true,
    state: {
      columnPinning: this.columnPinning(),
    },
    onColumnPinningChange: (updater: any) => {
      const current = this.columnPinning();
      const next = typeof updater === 'function' ? updater(current) : updater;
      this.columnPinning.set(next);
    },
  }));

  constructor() {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(query => {
        this.searchQuery.set(query);
        this.resetGridForNewSearch();
      })
    );
    this.fetchNextPage();
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.observer?.disconnect();
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  onSearchChange(event: Event): void {
    this.searchSubject.next((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.resetGridForNewSearch();
  }

  onRetry(): void {
    this.errorMessage.set(null);
    this.fetchNextPage();
  }

  // ── Data fetching ────────────────────────────────────────────────────────────

  fetchNextPage(): void {
    // Atomic guard: prevent concurrent fetches or fetching past the last page.
    if (this.isFetching || !this.hasNextPage()) return;
    this.isFetching = true;

    this.starships().length === 0
      ? this.isInitialLoading.set(true)
      : this.isBackgroundLoading.set(true);

    this.errorMessage.set(null);

    const wasInitialLoading = this.isInitialLoading();
    this.swapiService.getStarships(this.currentPage(), this.searchQuery()).subscribe({
      next: (response) => {
        const fresh = response.results.filter(
          s => !this.starships().some(e => e.url === s.url)
        );
        this.starships.update(c => [...c, ...fresh]);
        this.hasNextPage.set(response.next !== null);
        if (response.next) this.currentPage.update(p => p + 1);
        this.isInitialLoading.set(false);
        this.isBackgroundLoading.set(false);
        this.isFetching = false;
        // On the very first load the scrollAnchor element doesn't exist in the
        // DOM yet (it's inside @if (!isInitialLoading())).  The observer set up
        // in ngAfterViewInit therefore never attaches.  Re-attach it after
        // Angular has had a tick to render the now-visible table.
        if (wasInitialLoading) {
          setTimeout(() => this.setupIntersectionObserver(), 0);
        }
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Error loading data.');
        this.isInitialLoading.set(false);
        this.isBackgroundLoading.set(false);
        this.isFetching = false;
      }
    });
  }

  resetGridForNewSearch(): void {
    // Evict cached pages for the current (outgoing) search so a fresh query
    // always hits the network, while pages for the *new* query can still be
    // served from cache if the user reverts to a previous term.
    this.swapiService.clearCache(this.searchQuery());
    this.isFetching = false;
    this.starships.set([]);
    this.currentPage.set(1);
    this.hasNextPage.set(true);
    this.isInitialLoading.set(true);
    this.errorMessage.set(null);
    this.selectedRows.set(new Set());
    this.fetchNextPage();
    setTimeout(() => this.setupIntersectionObserver(), 150);
  }

  private setupIntersectionObserver(): void {
    this.observer?.disconnect();
    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && this.hasNextPage() &&
            !this.isBackgroundLoading() && !this.isInitialLoading() && !this.errorMessage()) {
          this.fetchNextPage();
        }
      },
      { root: null, rootMargin: '200px', threshold: 0.1 }
    );
    if (this.scrollAnchor?.nativeElement) {
      this.observer.observe(this.scrollAnchor.nativeElement);
    }
  }

  // ── Row selection ────────────────────────────────────────────────────────────

  toggleRow(url: string): void {
    this.selectedRows.update(set => {
      const next = new Set(set);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  }

  toggleAllRows(): void {
    if (this.allSelected()) {
      this.selectedRows.set(new Set());
    } else {
      this.selectedRows.set(new Set(this.processedStarships().map(r => r.url)));
    }
  }

  isRowSelected(url: string): boolean {
    return this.selectedRows().has(url);
  }

  // ── Column pinning ───────────────────────────────────────────────────────────

  isPinned(columnId: string): boolean {
    return this.columnPinning().left?.includes(columnId) ?? false;
  }

  pinColumn(columnId: string): void {
    this.columnPinning.update(state => ({
      ...state,
      left: [...(state.left ?? []).filter(id => id !== columnId), columnId]
    }));
  }

  unpinColumn(columnId: string): void {
    this.columnPinning.update(state => ({
      ...state,
      left: (state.left ?? []).filter(id => id !== columnId)
    }));
  }

  togglePin(columnId: string): void {
    this.isPinned(columnId) ? this.unpinColumn(columnId) : this.pinColumn(columnId);
  }

  /** Returns the sticky left offset for a pinned column */
  getPinnedOffset(columnId: string): number {
    const pinned = this.columnPinning().left ?? [];
    const idx = pinned.indexOf(columnId);
    if (idx === -1) return 0;
    let offset = 0;
    for (let i = 0; i < idx; i++) {
      const col = this.tableInstance.getColumn(pinned[i]);
      if (col) offset += col.getSize();
    }
    return offset;
  }

  // ── Cell editing ─────────────────────────────────────────────────────────────

  startEdit(url: string, columnId: string, currentValue: any): void {
    if (!this.isEditableColumn(columnId)) return;
    this.editingCell.set({ url, columnId: columnId as keyof Starship });
    this.editValue.set(String(currentValue ?? ''));
    setTimeout(() => {
      const el = document.querySelector('.cell-edit-input') as HTMLInputElement;
      el?.focus(); el?.select();
    }, 30);
  }

  saveEdit(): void {
    const active = this.editingCell();
    if (!active) return;
    this.dataStateService.updateStarship(active.url, active.columnId, this.editValue());
    this.editingCell.set(null);
  }

  cancelEdit(): void {
    this.editingCell.set(null);
  }

  onInputBlur(): void { this.saveEdit(); }

  onInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') { event.preventDefault(); this.saveEdit(); }
    else if (event.key === 'Escape') { this.cancelEdit(); }
  }

  onInputValueChange(event: Event): void {
    this.editValue.set((event.target as HTMLInputElement).value);
  }

  isEditing(url: string, columnId: string): boolean {
    const a = this.editingCell();
    return a !== null && a.url === url && a.columnId === columnId;
  }

  isEditableColumn(columnId: string): boolean {
    return columnId === 'crew' || columnId === 'passengers';
  }

  // ── Context menu ─────────────────────────────────────────────────────────────

  onRowContextMenu(event: MouseEvent, row: Starship, columnId: string): void {
    event.preventDefault();
    this.contextMenu.set({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      rowUrl: row.url,
      rowData: row,
      columnId,
    });
  }

  closeContextMenu(): void {
    this.contextMenu.update(m => ({ ...m, visible: false }));
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  onDocumentInteraction(): void {
    this.closeContextMenu();
  }

  ctxCopyName(): void {
    const name = this.contextMenu().rowData?.name ?? '';
    navigator.clipboard.writeText(name);
    this.closeContextMenu();
  }

  ctxCopyRow(): void {
    const row = this.contextMenu().rowData;
    if (row) navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    this.closeContextMenu();
  }

  ctxEditCrew(): void {
    const m = this.contextMenu();
    if (m.rowData) this.startEdit(m.rowData.url, 'crew', m.rowData.crew);
    this.closeContextMenu();
  }

  ctxEditPassengers(): void {
    const m = this.contextMenu();
    if (m.rowData) this.startEdit(m.rowData.url, 'passengers', m.rowData.passengers);
    this.closeContextMenu();
  }

  ctxToggleSelect(): void {
    const url = this.contextMenu().rowUrl;
    if (url) this.toggleRow(url);
    this.closeContextMenu();
  }

  ctxTogglePin(): void {
    const col = this.contextMenu().columnId;
    if (col && col !== 'select') this.togglePin(col);
    this.closeContextMenu();
  }

  ctxSelectAll(): void {
    this.toggleAllRows();
    this.closeContextMenu();
  }

  ctxClearSelection(): void {
    this.selectedRows.set(new Set());
    this.closeContextMenu();
  }

  getContextMenuColumnLabel(): string {
    const col = this.contextMenu().columnId;
    if (!col || col === 'select') return '';
    return this.columnMeta[col]?.label ?? col;
  }
}
