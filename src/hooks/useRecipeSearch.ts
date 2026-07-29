import { useState } from 'react'
import { useSupabase } from '../lib/supabase-context'
import type { Recipe, FridgeItem, RecipeWithMatch, SpoonacularRecipeInfo } from '../lib/database.types'
import { useFridgeMatch } from './useFridgeMatch'

export interface MacroTargets {
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
}

const SPOONACULAR_KEY = import.meta.env.VITE_SPOONACULAR_KEY as string
const CACHE_MIN_RESULTS = 5  // if cache has fewer than this, fetch from Spoonacular

// Spoonacular complexSearch response shape (only fields we use)
interface SpoonacularNutrient {
  name: string
  amount: number
}

interface SpoonacularRecipe {
  id: number
  title: string
  image: string
  sourceUrl: string
  readyInMinutes: number
  servings: number
  aggregateLikes: number
  spoonacularScore: number
  nutrition: {
    nutrients: SpoonacularNutrient[]
  }
}

interface SpoonacularSearchResponse {
  results: SpoonacularRecipe[]
  totalResults: number
}

function getNutrient(nutrients: SpoonacularNutrient[], name: string): number | null {
  return nutrients.find(n => n.name === name)?.amount ?? null
}

function toRecipeRow(r: SpoonacularRecipe): Recipe {
  const nutrients = r.nutrition?.nutrients ?? []
  return {
    id: r.id,
    title: r.title,
    image_url: r.image ?? null,
    source_url: r.sourceUrl ?? null,
    ready_in_minutes: r.readyInMinutes ?? null,
    servings: r.servings ?? null,
    aggregate_likes: r.aggregateLikes ?? null,
    spoonacular_score: r.spoonacularScore ?? null,
    calories: getNutrient(nutrients, 'Calories'),
    protein_g: getNutrient(nutrients, 'Protein'),
    carbs_g: getNutrient(nutrients, 'Carbohydrates'),
    fat_g: getNutrient(nutrients, 'Fat'),
    fiber_g: getNutrient(nutrients, 'Fiber'),
    cached_at: new Date().toISOString(),
  }
}

async function fetchFromSpoonacular(targets: MacroTargets): Promise<SpoonacularRecipe[]> {
  const params = new URLSearchParams({
    apiKey: SPOONACULAR_KEY,
    addRecipeNutrition: 'true',
    number: '20',
    sort: 'popularity',
  })

  // Spoonacular supports macro range filters — use generous windows so we
  // pull a broad set and let the RPC do the precise ranking
  if (targets.calories != null) {
    params.set('minCalories', String(Math.max(0, targets.calories - 200)))
    params.set('maxCalories', String(targets.calories + 200))
  }
  if (targets.protein != null) {
    params.set('minProtein', String(Math.max(0, targets.protein - 20)))
    params.set('maxProtein', String(targets.protein + 20))
  }
  if (targets.carbs != null) {
    params.set('minCarbs', String(Math.max(0, targets.carbs - 20)))
    params.set('maxCarbs', String(targets.carbs + 20))
  }
  if (targets.fat != null) {
    params.set('minFat', String(Math.max(0, targets.fat - 20)))
    params.set('maxFat', String(targets.fat + 20))
  }

  const res = await fetch(
    `https://api.spoonacular.com/recipes/complexSearch?${params.toString()}`
  )

  if (!res.ok) {
    if (res.status === 402) throw new Error('Spoonacular daily quota exceeded')
    throw new Error(`Spoonacular error: ${res.status}`)
  }

  const data: SpoonacularSearchResponse = await res.json()
  return data.results ?? []
}

/**
 * Fetch ingredient lists for a batch of recipe IDs using informationBulk.
 * Returns an array of recipe info objects, each containing extendedIngredients.
 * Only fetches IDs that don't already have ingredients cached.
 */
async function fetchIngredientsBulk(recipeIds: number[]): Promise<SpoonacularRecipeInfo[]> {
  if (recipeIds.length === 0) return []

  const params = new URLSearchParams({
    apiKey: SPOONACULAR_KEY,
    ids: recipeIds.join(','),
    includeNutrition: 'false',
  })

  const res = await fetch(
    `https://api.spoonacular.com/recipes/informationBulk?${params.toString()}`
  )

  if (!res.ok) {
    // Non-fatal — ingredient data is best-effort
    console.warn(`informationBulk error: ${res.status}`)
    return []
  }

  return res.json() as Promise<SpoonacularRecipeInfo[]>
}

export function useRecipeSearch() {
  const supabase = useSupabase()
  const { matchRecipesToFridge, isMatching } = useFridgeMatch()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [tieredRecipes, setTieredRecipes] = useState<RecipeWithMatch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [lastTargets, setLastTargets] = useState<MacroTargets | null>(null)

  async function search(targets: MacroTargets, fridgeItems: FridgeItem[] = []) {
    // Require at least one target
    if (
      targets.calories == null &&
      targets.protein == null &&
      targets.carbs == null &&
      targets.fat == null
    ) return

    setIsLoading(true)
    setError(null)
    setRecipes([])
    setTieredRecipes([])
    setHasSearched(false)
    setLastTargets(targets)

    try {
      // 1. Check cache first
      const { data: cached, error: rpcError } = await supabase.rpc('search_recipes', {
        target_cal: targets.calories ?? null,
        target_protein: targets.protein ?? null,
        target_carbs: targets.carbs ?? null,
        target_fat: targets.fat ?? null,
      })

      if (rpcError) throw new Error(rpcError.message)

      const cachedResults = cached ?? []

      if (cachedResults.length >= CACHE_MIN_RESULTS) {
        setRecipes(cachedResults)
        void backfillMissingIngredients(cachedResults.map(r => r.id))
        const tiered = await matchRecipesToFridge(cachedResults, fridgeItems)
        setTieredRecipes(tiered)
        return
      }

      // 2. Cache miss — fetch from Spoonacular
      const spoonResults = await fetchFromSpoonacular(targets)

      if (spoonResults.length > 0) {
        const rows = spoonResults.map(toRecipeRow)

        const { error: upsertError } = await supabase
          .from('recipes')
          .upsert(rows, { onConflict: 'id' })

        if (upsertError) {
          console.warn('Failed to cache recipes:', upsertError.message)
        }

        const newIds = spoonResults.map(r => r.id)
        void fetchAndStoreIngredients(newIds)

        // 3. Re-query so ranking SQL applies
        const { data: fresh, error: freshError } = await supabase.rpc('search_recipes', {
          target_cal: targets.calories ?? null,
          target_protein: targets.protein ?? null,
          target_carbs: targets.carbs ?? null,
          target_fat: targets.fat ?? null,
        })

        if (freshError) throw new Error(freshError.message)
        const freshResults = fresh ?? []
        setRecipes(freshResults)
        const tiered = await matchRecipesToFridge(freshResults, fridgeItems)
        setTieredRecipes(tiered)
      } else {
        setRecipes(cachedResults)
        const tiered = await matchRecipesToFridge(cachedResults, fridgeItems)
        setTieredRecipes(tiered)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recipe search failed')
    } finally {
      setIsLoading(false)
      setHasSearched(true)
    }
  }

  /**
   * Fetch ingredient data from Spoonacular and upsert into recipe_ingredients.
   * Skips any recipe IDs that already have ingredients stored.
   */
  async function fetchAndStoreIngredients(recipeIds: number[]): Promise<void> {
    if (recipeIds.length === 0) return

    // Check which recipe IDs already have ingredients in the DB
    const { data: existing, error: selectError } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id')
      .in('recipe_id', recipeIds)

    if (selectError) {
      console.warn('[ingredients] select error:', selectError.message)
      return
    }

    const existingIds = new Set((existing ?? []).map(r => r.recipe_id))
    const missingIds = recipeIds.filter(id => !existingIds.has(id))

    if (missingIds.length === 0) return

    const recipeInfos = await fetchIngredientsBulk(missingIds)
    if (recipeInfos.length === 0) return

    const ingredientRows = recipeInfos.flatMap(recipe =>
      (recipe.extendedIngredients ?? []).map(ing => ({
        recipe_id: recipe.id,
        spoonacular_ingredient_id: ing.id ?? null,
        ingredient_name: ing.name,
        amount_metric: ing.measures?.metric?.amount ?? ing.amount ?? null,
        unit_metric: ing.measures?.metric?.unitShort ?? ing.unit ?? null,
      }))
    )

    // Deduplicate by (recipe_id, ingredient_name) — some recipes list the same
    // ingredient twice (e.g. "salt" in two steps), which causes Postgres to
    // reject the batch with "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const seen = new Set<string>()
    const dedupedRows = ingredientRows.filter(row => {
      const key = `${row.recipe_id}:${row.ingredient_name}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    if (dedupedRows.length === 0) return

    // Upsert — unique index on (recipe_id, ingredient_name) prevents duplicates
    const { error } = await supabase
      .from('recipe_ingredients')
      .upsert(dedupedRows, { onConflict: 'recipe_id,ingredient_name' })

    if (error) {
      console.warn('Failed to store ingredient data:', error.message)
    }
  }

  /**
   * For cache-hit searches, check if any returned recipes are missing ingredient
   * data and fetch it in the background.
   */
  async function backfillMissingIngredients(recipeIds: number[]): Promise<void> {
    await fetchAndStoreIngredients(recipeIds)
  }

  function reset() {
    setRecipes([])
    setTieredRecipes([])
    setError(null)
    setHasSearched(false)
    setLastTargets(null)
  }

  return { recipes, tieredRecipes, isLoading: isLoading || isMatching, error, hasSearched, lastTargets, search, reset }
}
