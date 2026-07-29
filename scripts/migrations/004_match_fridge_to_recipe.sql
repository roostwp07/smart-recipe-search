-- Migration: fridge-to-recipe ingredient matching
--
-- Requires pg_trgm (almost certainly already enabled for search_foods).
-- If not: CREATE EXTENSION IF NOT EXISTS pg_trgm;
--
-- Run in Supabase SQL editor or via psql.

-- ─────────────────────────────────────────────────────────────────
-- Helper: word containment score
--
-- Returns the fraction of words in `needle` that appear as whole words
-- anywhere in `haystack` (case-insensitive).
--
-- Examples:
--   word_containment('cottage cheese', 'nordica 2% cottage cheese') → 1.0
--   word_containment('cottage cheese', 'cream cheese')              → 0.5
--   word_containment('milk', 'skim milk powder')                    → 1.0
--   word_containment('oil', 'olive oil extra virgin')               → 1.0
-- ─────────────────────────────────────────────────────────────────
create or replace function word_containment(needle text, haystack text)
returns numeric
language plpgsql
immutable
as $$
declare
  needle_words   text[];
  matched        integer := 0;
  w              text;
begin
  -- Split needle into words, remove empty strings
  needle_words := array_remove(
    string_to_array(lower(trim(needle)), ' '),
    ''
  );

  if array_length(needle_words, 1) is null then
    return 0;
  end if;

  foreach w in array needle_words loop
    -- whole-word match in haystack (word boundary via \m and \M)
    if lower(haystack) ~ ('\m' || regexp_replace(w, '([.*+?^${}()|[\]\\])', '\\\1', 'g') || '\M') then
      matched := matched + 1;
    end if;
  end loop;

  return matched::numeric / array_length(needle_words, 1);
end;
$$;


-- ─────────────────────────────────────────────────────────────────
-- RPC: match_fridge_to_recipe(p_recipe_id)
--
-- For a given recipe, scores every (ingredient, fridge_item) pair and
-- returns the best match per ingredient, classified into tiers:
--
--   exact    — containment = 1.0 AND trigram ≥ 0.3
--   likely   — containment = 1.0 OR  trigram ≥ 0.5
--   possible — containment ≥ 0.5 OR  trigram ≥ 0.3
--   no_match — everything else (not returned)
--
-- Only returns the single best-scoring fridge match per ingredient.
-- ─────────────────────────────────────────────────────────────────
create or replace function match_fridge_to_recipe(p_recipe_id integer)
returns table (
  ingredient_name           text,
  amount_metric             numeric,
  unit_metric               text,
  fridge_item_id            integer,
  fridge_food_id            integer,
  fridge_food_name          text,
  -- per-100g macros of the matched fridge item (for recalculation)
  calories_per_100g         numeric,
  protein_per_100g          numeric,
  carbs_per_100g            numeric,
  fat_per_100g              numeric,
  fiber_per_100g            numeric,
  -- match quality
  match_tier                text,
  containment_score         numeric,
  trigram_score             numeric
)
language sql
stable
as $$
  with

  -- All ingredients for this recipe
  ingredients as (
    select
      ri.ingredient_name,
      ri.amount_metric,
      ri.unit_metric
    from recipe_ingredients ri
    where ri.recipe_id = p_recipe_id
  ),

  -- All fridge items with food macros (already joined by get_fridge logic)
  fridge as (
    select
      fi.id          as fridge_item_id,
      fi.food_id     as fridge_food_id,
      f.name         as fridge_food_name,
      f.calories     as calories_per_100g,
      f.protein_g    as protein_per_100g,
      f.carbs_g      as carbs_per_100g,
      f.fat_g        as fat_per_100g,
      f.fiber_g      as fiber_per_100g
    from fridge_items fi
    join foods f on f.id = fi.food_id
  ),

  -- Score every (ingredient, fridge_item) pair
  scored as (
    select
      i.ingredient_name,
      i.amount_metric,
      i.unit_metric,
      fr.fridge_item_id,
      fr.fridge_food_id,
      fr.fridge_food_name,
      fr.calories_per_100g,
      fr.protein_per_100g,
      fr.carbs_per_100g,
      fr.fat_per_100g,
      fr.fiber_per_100g,
      word_containment(i.ingredient_name, fr.fridge_food_name)             as containment,
      similarity(lower(i.ingredient_name), lower(fr.fridge_food_name))    as trgm
    from ingredients i
    cross join fridge fr
  ),

  -- Classify into tiers and keep only matches worth showing
  classified as (
    select
      *,
      case
        when containment = 1.0 and trgm >= 0.3  then 'exact'
        when containment = 1.0 or  trgm >= 0.5  then 'likely'
        when containment >= 0.5 or trgm >= 0.3  then 'possible'
        else null
      end as tier
    from scored
  ),

  -- Best match per ingredient (highest containment, then trigram as tiebreak)
  best as (
    select distinct on (ingredient_name)
      ingredient_name,
      amount_metric,
      unit_metric,
      fridge_item_id,
      fridge_food_id,
      fridge_food_name,
      calories_per_100g,
      protein_per_100g,
      carbs_per_100g,
      fat_per_100g,
      fiber_per_100g,
      tier,
      containment,
      trgm
    from classified
    where tier is not null
    order by ingredient_name, containment desc, trgm desc
  )

  select
    ingredient_name,
    amount_metric,
    unit_metric,
    fridge_item_id,
    fridge_food_id,
    fridge_food_name,
    calories_per_100g,
    protein_per_100g,
    carbs_per_100g,
    fat_per_100g,
    fiber_per_100g,
    tier       as match_tier,
    containment as containment_score,
    trgm        as trigram_score
  from best
  order by
    case tier
      when 'exact'    then 1
      when 'likely'   then 2
      when 'possible' then 3
    end,
    ingredient_name;
$$;
