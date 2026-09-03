# Star Wars Fleet Directory

A single-page Angular application displaying Star Wars starship data from the [SWAPI](https://swapi.dev/) API in a feature-rich data grid.

## Installation & Running

```bash
# Install dependencies
yarn install

# Start the development server
yarn start
# → http://localhost:4200

# Run tests
yarn test

# Build for production
yarn build
```

## SWAPI Resource

**Starships** — `https://swapi.dev/api/starships`

This endpoint returns the full starship array in one request.

## Features

### Infinite Scroll — No Loader While Scrolling

All starships are fetched in a single HTTP request on first load and cached in the service layer. Subsequent "pages" are served synchronously by slicing the cached array — no network round-trips occur during scroll.

The `IntersectionObserver` watches a hidden sentinel `<div>` below the table. When it enters the viewport (with a 200 px early trigger), `fetchNextPage()` slices the next 10 items from the cache and appends them to the displayed rows.

Because page retrieval after the first fetch is purely synchronous (no async gap), there is no visual delay and therefore no loading indicator is shown during scrolling. Only the very first data load shows a spinner — all subsequent infinite-scroll appends happen seamlessly.

### Editable Columns

**Crew** and **Passengers** are editable. Both columns show a pencil icon on hover.

- **Start editing:** double-click the cell.
- **Save:** press `Enter` or click away (blur).
- **Cancel:** press `Escape`.

Edits are stored in `DataStateService` as a `Record<string, Partial<Starship>>` keyed by each starship's `url`. A computed signal (`processedStarships`) merges fetched data with local edits before rendering. The service includes a comment showing exactly where an HTTP `PATCH` call would go to swap in real API writes.

### Column Resizing

Column resizing is powered by **TanStack Angular Table v8**'s built-in `enableColumnResizing` feature with `columnResizeMode: 'onChange'`. A transparent resize handle (4 px wide) sits at the right edge of each `<th>`. It appears as a blue bar on hover or while dragging. Width changes apply immediately as the user drags.

### Search / Filter

A debounced (300 ms) text input filters starships by **name or model** against the cached full dataset. Filtering is instant — no additional HTTP requests. Clearing the input or changing the query resets the grid and re-slices from the cache.

## Architecture

| File | Role |
|---|---|
| `services/swapi.service.ts` | HTTP fetch, in-memory cache, client-side pagination & search |
| `services/data-state.service.ts` | Signal-based edit store; easy to swap for API writes |
| `components/data-grid/data-grid.component.ts` | TanStack Table setup, infinite scroll, edit state wiring |
| `components/data-grid/data-grid.component.html` | Table template, editable cells, empty/error states |

## Third-Party Packages

| Package | Purpose |
|---|---|
| `@tanstack/angular-table` v8 | Headless table — column sizing, row models |
| `tailwindcss` v4 | Utility-first CSS |

## Trade-offs & Limitations

- **No column sorting:** TanStack Table's `getSortedRowModel` was intentionally excluded to keep scope focused on the stated requirements.
- **No column visibility toggle:** All 13 columns are always shown; horizontal scroll handles narrow viewports.
- **Edit persistence:** Edits survive search/navigation within the session but are lost on page refresh, as intended by the requirement (client state only).
