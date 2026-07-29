import { useState } from 'react'
import { useSupabase } from '../lib/supabase-context'
import type { Recipe } from '../lib/database.types'

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

export function useRecipeSearch() {
  const supabase = useSupabase()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [lastTargets, setLastTargets] = useState<MacroTargets | null>(null)

  async function search(targets: MacroTargets) {
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
        // Cache hit — use it directly
        setRecipes(cachedResults)
        return
      }

      // 2. Cache miss — fetch from Spoonacular
      const spoonResults = await fetchFromSpoonacular(targets)

      if (spoonResults.length > 0) {
        const rows = spoonResults.map(toRecipeRow)

        // Upsert into cache (ignore conflicts on id — update all fields)
        const { error: upsertError } = await supabase
          .from('recipes')
          .upsert(rows, { onConflict: 'id' })

        if (upsertError) {
          // Non-fatal — log but continue with data we have
          console.warn('Failed to cache recipes:', upsertError.message)
        }

        // 3. Re-query the RPC so ranking SQL applies to the freshly cached data
        const { data: fresh, error: freshError } = await supabase.rpc('search_recipes', {
          target_cal: targets.calories ?? null,
          target_protein: targets.protein ?? null,
          target_carbs: targets.carbs ?? null,
          target_fat: targets.fat ?? null,
        })

        if (freshError) throw new Error(freshError.message)
        setRecipes(fresh ?? [])
      } else {
        // Spoonacular returned nothing — show whatever was in cache (even if sparse)
        setRecipes(cachedResults)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recipe search failed')
    } finally {
      setIsLoading(false)
      setHasSearched(true)
    }
  }

  function reset() {
    setRecipes([])
    setError(null)
    setHasSearched(false)
    setLastTargets(null)
  }

  return { recipes, isLoading, error, hasSearched, lastTargets, search, reset }
}
