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

## Current phase: V2 complete, working on deeper fridge integration

V1 (virtual fridge) and V2 (recipe search) are both complete. The current focus is fridge-aware recipe ranking and macro recalculation from the user's actual branded products.

### What's built

- **Food search**: Debounced autocomplete against the `foods` table (Open Food Facts data) via `search_foods` RPC.
- **Fridge management**: Add items (with quantity, unit, optional expiry), view contents, remove items. Backed by `fridge_items` table, loaded via `get_fridge` RPC.
- **Recipe search (V2, complete)**: Macro-targeted search via Spoonacular `complexSearch` API. Results are cached in a `recipes` table in Supabase. Re-queries are served from cache via `search_recipes` RPC. Cache miss threshold: 5 results.
- **Skeuomorphic fridge UI**: Closed door shows fridge management (V1). Opening the door reveals recipe search (V2). Implemented in `SmartFridge.tsx` with CSS 3D transforms.
- **"Use fridge macros" prefill**: Sums macros across all fridge items and prefills the macro target form. Functional but shallow — does not yet check ingredient overlap.

### Component structure

```
src/
├── components/
│   ├── SmartFridge.tsx      # Root component — fridge scene, door open/close logic
│   ├── SmartFridge.css      # All fridge styles including 3D transforms
│   ├── FoodSearch.tsx       # Debounced autocomplete food search
│   ├── AddItemForm.tsx      # Quantity/unit/expiry form after food selection
│   ├── FridgeDisplay.tsx    # Current fridge contents with macros
│   ├── MacroTargetForm.tsx  # Macro target inputs + "use fridge macros" prefill
│   └── RecipeResults.tsx    # Recipe cards (currently shows Spoonacular macros)
├── hooks/
│   ├── useFridge.ts         # Fridge state: load, add, remove (calls get_fridge RPC)
│   └── useRecipeSearch.ts   # Recipe search: cache check → Spoonacular → upsert → re-rank
└── lib/
    ├── supabase-context.tsx
    └── database.types.ts    # Types for Recipe, FridgeItem, Database
```

### Tech stack

- **Frontend**: React + TypeScript, built with Vite
- **Backend/DB**: Supabase (PostgreSQL). SQL practice is an explicit goal — prefer raw SQL and `.rpc()` for calling Postgres functions over the JS query builder.
- **Recipe data**: Spoonacular API (`VITE_SPOONACULAR_KEY`). Uses `complexSearch` with `addRecipeNutrition=true`. Cached in Supabase `recipes` table.
- **Food data**: Open Food Facts bulk CSV, imported into `foods` table. No `categories_en` field — was dropped during import.

### Database schema

- `foods` — seeded from Open Food Facts. Columns: `id`, `name`, `brand`, `barcode`, `serving_size_g`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `sodium_mg`, `image_url`.
- `fridge_items` — user's fridge. FK to `foods`, plus `quantity`, `unit`, `date_added`, `expiry_date`. `get_fridge` RPC joins to `foods` and returns full nutritional info.
- `recipes` — Spoonacular cache. Columns: `id` (Spoonacular ID), `title`, `image_url`, `source_url`, `ready_in_minutes`, `servings`, `aggregate_likes`, `spoonacular_score`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `cached_at`.
- `recipe_ingredients` — **planned, not yet created**. Will store per-recipe ingredient lists fetched from Spoonacular. Needed for fridge matching and macro recalculation.

### RPC functions

- `search_foods(query, max_results)` — full-text + trigram search over `foods`.
- `get_fridge()` — returns `fridge_items` joined with `foods`.
- `search_recipes(target_cal, target_protein, target_carbs, target_fat, cal_tolerance, macro_tolerance, max_results)` — ranks cached recipes by macro distance.

### What's next: fridge-aware recipe ranking + macro recalculation

**The problem**: when a user searches for recipes, we want to:
1. Surface recipes that use ingredients already in their fridge
2. Show "close match" recipes that need only a few extra items
3. Replace Spoonacular's generic macro values with macros calculated from the user's actual branded products

**Step 1 — fetch and store recipe ingredients:**
- After caching recipes, call Spoonacular `GET /recipes/{ids}/informationBulk?includeNutrition=false` to get ingredient lists
- Each ingredient has `name`, `amount`, `unit`, and critically `measures.metric.amount` + `measures.metric.unitShort` (gives grams directly — avoids density lookup problem)
- Store in `recipe_ingredients` table: `recipe_id`, `ingredient_name`, `amount_metric_g` (the pre-converted gram value from Spoonacular)

**Step 2 — ingredient matching (Postgres-native, no LLM for most cases):**
- Use `pg_trgm` trigram similarity between normalized ingredient name and fridge item `food_name`
- Secondary signal: word-set overlap (Jaccard) — "cottage cheese" words fully contained in "2% Lactose Free Cottage Cheese"
- Classify pairs into `exact` / `likely` / `possible` / `no_match` tiers
- LLM API (Claude/Spoonacular) as fallback only when trigram score is below threshold (targeted, cheap)

**Step 3 — macro recalculation:**
- For matched ingredients: scale fridge item's per-100g macros by `amount_metric_g / 100`
- Sum across all matched ingredients for the recipe
- Display recalculated macros instead of Spoonacular values

**Step 4 — UI tiering:**
- "In your fridge" — all/most ingredients matched
- "Close match" — partial overlap (show missing ingredients)
- Standard results below

**Key decision**: Spoonacular's `measures.metric` field is the correct way to get ingredient amounts in grams — it avoids the cup→gram density conversion problem. Always use this when available.

### Key constraints

- Component must have clean prop interfaces (`supabaseUrl`, `supabaseAnonKey`, callbacks like `onItemAdded`/`onItemRemoved`) and zero dependency on any host app code.
- No imports from outside the component's own directory tree.
- Keep the interface minimal — personal tool, not a product. Functional > polished.

## Where this is headed (not yet in scope)

- **Micro-app export**: Bundle to self-mount via script tag with `SmartFridge.init({ target, config })`, framework-agnostic.
- **Barcode scanning**: Open Food Facts barcode lookup API as fallback for products not in the local DB.
- **V3 — Open fridge interior**: Recipe results displayed as items on physical fridge shelves. Triggered by the "open fridge" interaction. Skeuomorphic, modern-appliance aesthetic.

## Visual concept

- **Closed fridge** (current): The fridge door. Embedded screen shows food search and fridge contents.
- **Open fridge** (current): Door swings open (CSS 3D transform, left hinge). Interior panel shows recipe search and results.
- Future: Interior shelves display recipe cards physically arranged on shelves.
