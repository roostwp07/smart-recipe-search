-- Migration: recipe_ingredients table
-- Stores per-recipe ingredient lists fetched from Spoonacular informationBulk.
-- Used for fridge matching and macro recalculation.
--
-- Run in Supabase SQL editor or via psql.

create table if not exists recipe_ingredients (
  id                      serial primary key,
  recipe_id               integer not null references recipes(id) on delete cascade,
  spoonacular_ingredient_id integer,                    -- Spoonacular's ingredient id (e.g. 1001 = butter)
  ingredient_name         text    not null,              -- generic name, e.g. "cottage cheese"
  amount_metric           numeric,                       -- amount in metric unit (grams/ml) from measures.metric.amount
  unit_metric             text,                          -- metric unit, e.g. "g", "ml", "Tbsp" (blank = count/piece)
  created_at              timestamptz default now()
);

-- Fast lookups by recipe
create index if not exists recipe_ingredients_recipe_id_idx
  on recipe_ingredients(recipe_id);

-- Prevent duplicate ingredients per recipe (idempotent re-fetches)
create unique index if not exists recipe_ingredients_recipe_ingredient_uniq
  on recipe_ingredients(recipe_id, ingredient_name);


-- ─────────────────────────────────────────────────────────────────
-- RPC: get_recipe_ingredients(p_recipe_id)
-- Returns all ingredients for a given recipe.
-- ─────────────────────────────────────────────────────────────────
create or replace function get_recipe_ingredients(p_recipe_id integer)
returns table (
  id                        integer,
  recipe_id                 integer,
  spoonacular_ingredient_id integer,
  ingredient_name           text,
  amount_metric             numeric,
  unit_metric               text
)
language sql
stable
as $$
  select
    id,
    recipe_id,
    spoonacular_ingredient_id,
    ingredient_name,
    amount_metric,
    unit_metric
  from recipe_ingredients
  where recipe_id = p_recipe_id
  order by id;
$$;
