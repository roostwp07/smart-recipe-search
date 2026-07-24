# Smart Recipe Search — Project Guidance

## Commands

```bash
npm run dev       # Start dev server with HMR
npm run build     # Type-check then bundle for production (tsc -b && vite build)
npm run lint      # Run oxlint
npm run preview   # Serve the production build locally
```

## Tooling notes

- **React Compiler** is enabled — do not add manual `useMemo`/`useCallback`, the compiler handles memoization automatically.
- **Linter** is oxlint (not ESLint). Config in `.oxlintrc.json`.
- **Supabase queries**: prefer raw SQL via `.rpc()` over the JS query builder where it makes sense (SQL practice is an explicit goal).

## What this is

An exportable React component (TypeScript, Vite) — a smart recipe search engine powered by a user's virtual fridge. Embeddable in any React app or mountable standalone as a micro-app. Target audience: gym rats and people serious about nutrition.

## Current phase: V1 — Virtual Fridge

V1 is just the fridge. No recipe logic yet. The goal is to let a user search for food products, view nutritional info, and add them to a personal virtual fridge.

### Core functionality

- **Food search**: Autocomplete-style search against a local foods database seeded from Open Food Facts. User types a query, sees matching products with nutrition info, selects one to add.
- **Fridge management**: Add items (with quantity, date added, optional expiry), view current fridge contents, remove items.
- **Nutrition data**: Every fridge item carries full nutritional info (calories, protein, carbs, fat, fiber, sodium, etc.) sourced from Open Food Facts.

### Tech stack

- **Frontend**: React + TypeScript, built with Vite
- **Backend/DB**: Supabase (PostgreSQL). SQL practice is an explicit goal — prefer raw SQL and `.rpc()` for calling Postgres functions over the JS query builder where it makes sense.
- **Data source**: Open Food Facts bulk data, imported into a `foods` table in Supabase. May supplement with USDA FoodData Central later if coverage gaps appear.

### Database schema

- `foods` — seeded from Open Food Facts. Columns: product name, brand, barcode, serving size, calories, protein, carbs, fat, and micronutrients. Supports full-text search.
- `fridge_items` — user's fridge contents. Foreign key to `foods`, plus quantity, unit, date_added, expiry_date.

### Key constraints

- Component must have clean prop interfaces (`supabaseUrl`, auth token, callbacks like `onItemAdded`/`onItemRemoved`) and zero dependency on any host app code.
- No imports from outside the component's own directory tree.
- Keep the interface minimal — this is a personal tool, not a product. Functional > polished.

## Where this is headed (not yet in scope)

- **V2 — Recipe search**: Given fridge contents and exact nutritional info per item, let the user enter target macros (e.g. 600 cal, 40g protein) and return exact then close matches. Real recipes scraped from the internet with openly displayable ratings. Sort by relevance then by cook time (shorter is better).
- **Micro-app export**: Bundle to self-mount via script tag with `SmartFridge.init({ target, config })`, framework-agnostic.
- **Barcode scanning**: Use Open Food Facts barcode lookup API as fallback for products not in the local DB.

## Visual concept: closed/open fridge states

- **Closed fridge** (V1+): The fridge door. An embedded screen shows food search and fridge contents — the control panel on the door.
- **Open fridge** (V2+): Triggered by an "open" interaction. The fridge swings open to reveal the interior — shelves display recipe results. The transition should feel like physically opening a fridge. Skeuomorphic, modern-appliance aesthetic throughout.
