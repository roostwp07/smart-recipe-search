# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server with HMR
npm run build     # Type-check then bundle for production (tsc -b && vite build)
npm run lint      # Run oxlint
npm run preview   # Serve the production build locally
```

## Notes

- **React Compiler** is enabled — do not add manual `useMemo`/`useCallback`, the compiler handles memoization automatically.
- **Linter** is oxlint (not ESLint). Config in `.oxlintrc.json`.
- **Supabase queries**: prefer raw SQL via `.rpc()` over the JS query builder where it makes sense (SQL practice is an explicit goal).

---

# Smart Recipe Search

## What this is

An exportable React component (TypeScript, Vite) that will eventually be a smart recipe search engine powered by a user's virtual fridge. Designed to be embeddable in any React app or mounted standalone as a micro-app. Intended audience consists of gym rats and people who are super serious about nutrition.

## Current phase: V1 — Virtual Fridge

V1 is just the fridge. No recipe logic yet. The goal is to let a user search for food products, view their nutritional info, and add them to a personal virtual fridge.

### Core functionality

- **Food search**: Autocomplete-style search against a local foods database seeded from Open Food Facts. User types a query, sees matching products with nutrition info, and selects one to add.
- **Fridge management**: Add items (with quantity, date added, optional expiry), view current fridge contents, remove items.
- **Nutrition data**: Every fridge item carries full nutritional info (calories, protein, carbs, fat, fiber, sodium, etc.) sourced from Open Food Facts.

### Tech stack

- **Frontend**: React + TypeScript, built with Vite
- **Backend/DB**: Supabase (PostgreSQL). SQL practice is an explicit goal — prefer raw SQL and Supabase's `.rpc()` for calling Postgres functions over using the JS client's query builder where it makes sense.
- **Data source**: Open Food Facts bulk data, imported into a `foods` table in Supabase. May supplement with USDA FoodData Central later if coverage gaps appear.

### Database design (planned)

- `foods` — seeded from Open Food Facts. Columns for product name, brand, barcode, serving size, calories, protein, carbs, fat, and other micronutrients. Should support full-text search.
- `fridge_items` — user's fridge contents. Foreign key to `foods`, plus quantity, unit, date_added, expiry_date.

### Key constraints

- Component must have clean prop interfaces (Supabase URL, auth token, callbacks like `onItemAdded`/`onItemRemoved`) and zero dependency on any host app code.
- No imports from outside the component's own directory tree.
- Keep the interface minimal — this is a personal tool, not a product. Functional > polished.

## Where this is headed (not yet in scope)

- **V2 — Recipe search**: Given what's in the fridge, as well as the specific nutrition information of each item (e.g. exact calories and protein; this can often vary across different brands even for the same food), allow the user to enter the exact nutritional information (e.g. 600 calories and 40 g protein) they want in a recipe into the search engine, then return exact matching results followed by close matches (haven't yet determined what constitutes a close match). These must be real recipes made by real people scraped from the internet, with ratings that can be openly displayed. Sort the recipes first by relevance, then by time (the less time it takes to make, the better). Likely integrates a recipe API or dataset.
- **Micro-app export**: Bundle the component so it can self-mount into any page via a script tag and `SmartFridge.init({ target, config })`, framework-agnostic.
- **Barcode scanning**: Use Open Food Facts barcode lookup API as a fallback for products not in the local DB.