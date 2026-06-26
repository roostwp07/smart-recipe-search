# Smart Recipe Search

An embeddable React component for managing a virtual fridge. Search for food products by name, view full nutritional info, and track what's in your fridge. Built for anyone serious about nutrition.

Powered by [Open Food Facts](https://world.openfoodfacts.org) data and [Supabase](https://supabase.com).

## Project structure

```
smart-recipe-search/
├── data/                      # Local OFFs CSV export (gitignored — see setup below)
├── scripts/
│   └── seed_foods.py          # Transforms OFFs CSV into a Supabase-ready import file
├── src/
│   ├── components/
│   │   ├── SmartFridge.tsx    # Root exportable component
│   │   ├── FoodSearch.tsx     # Debounced autocomplete food search
│   │   ├── AddItemForm.tsx    # Quantity/unit/expiry form after food selection
│   │   ├── FridgeDisplay.tsx  # Current fridge contents with macros
│   │   └── SmartFridge.css
│   ├── hooks/
│   │   └── useFridge.ts       # Fridge state: load, add, remove
│   └── lib/
│       ├── supabase-context.tsx
│       └── database.types.ts
└── App.tsx                    # Dev wrapper (not part of the exported component)
```

## Setup

### 1. Supabase

Create a Supabase project and run the schema migrations to create the `foods` and `fridge_items` tables and the `search_foods`/`get_fridge` RPC functions. Add your project URL and anon key to `.env.local`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 2. Seed the foods database

The foods data comes from the [Open Food Facts](https://world.openfoodfacts.org/data) bulk CSV export. It's several gigabytes so it can't be committed to this repo — you'll need to download it yourself.

1. Go to [world.openfoodfacts.org/data](https://world.openfoodfacts.org/data) and download the **CSV export** (the full world export, not a country subset)
2. Place the extracted `.csv` file in the `data/` folder
3. Run the transform script:
   ```bash
   python scripts/seed_foods.py data/<filename>.csv data/foods_import.csv
   ```
4. Load the result into Supabase:
   ```bash
   psql <your-connection-string> -c "\COPY foods(name,brand,barcode,serving_size_g,calories,protein_g,carbs_g,fat_g,fiber_g,sodium_mg) FROM 'data/foods_import.csv' CSV HEADER"
   ```

### 3. Run the dev server

```bash
npm install
npm run dev
```

## Using the component

```tsx
import { SmartFridge } from './src/components/SmartFridge'

<SmartFridge
  supabaseUrl="..."
  supabaseAnonKey="..."
  onItemAdded={(item) => console.log('added', item)}
  onItemRemoved={(id) => console.log('removed', id)}
/>
```
