import { useState } from 'react'
import { useSupabase } from '../lib/supabase-context'
import type { Recipe, FridgeItem, MatchResult, RecalculatedMacros, RecipeWithMatch } from '../lib/database.types'

// Fraction of ingredients (exact/likely matches only) required to qualify as
// "in your fridge" vs "close match"
const FRIDGE_TIER_THRESHOLD = 0.75

/**
 * Compute recalculated macros from matched ingredients.
 *
 * For each matched ingredient:
 *   macro_contribution = (amount_metric_g / 100) * food_macro_per_100g
 *
 * We only include ingredients where amount_metric is a gram/ml value
 * (i.e. unit_metric is 'g', 'ml', or blank — not 'Tbsp', 'cloves', etc.)
 * because non-gram units can't be scaled against per-100g values reliably.
 */
function computeRecalculatedMacros(
  matches: MatchResult[],
  totalIngredientCount: number,
): RecalculatedMacros | null {
  // Only scale ingredients we have gram amounts for
  const scalable = matches.filter(
    m => m.amount_metric != null && isGramUnit(m.unit_metric)
  )

  if (scalable.length === 0) return null

  let calories = 0
  let protein_g = 0
  let carbs_g = 0
  let fat_g = 0
  let fiber_g = 0

  for (const m of scalable) {
    const scale = m.amount_metric! / 100
    calories  += (m.calories_per_100g  ?? 0) * scale
    protein_g += (m.protein_per_100g   ?? 0) * scale
    carbs_g   += (m.carbs_per_100g     ?? 0) * scale
    fat_g     += (m.fat_per_100g       ?? 0) * scale
    fiber_g   += (m.fiber_per_100g     ?? 0) * scale
  }

  return {
    calories:      Math.round(calories),
    protein_g:     Math.round(protein_g * 10) / 10,
    carbs_g:       Math.round(carbs_g   * 10) / 10,
    fat_g:         Math.round(fat_g     * 10) / 10,
    fiber_g:       Math.round(fiber_g   * 10) / 10,
    matched_count: matches.length,
    total_count:   totalIngredientCount,
  }
}

/** Units we can meaningfully scale against per-100g macros */
function isGramUnit(unit: string | null): boolean {
  if (unit == null || unit === '') return false
  const u = unit.toLowerCase()
  return u === 'g' || u === 'ml' || u === 'grams' || u === 'milliliters'
}

export function useFridgeMatch() {
  const supabase = useSupabase()
  const [isMatching, setIsMatching] = useState(false)

  /**
   * Given a list of recipes and the current fridge contents, call
   * match_fridge_to_recipe for each recipe (in parallel), compute
   * recalculated macros, and return the recipes tiered by fridge overlap.
   *
   * Returns empty array immediately if fridge is empty.
   */
  async function matchRecipesToFridge(
    recipes: Recipe[],
    fridgeItems: FridgeItem[],
  ): Promise<RecipeWithMatch[]> {
    if (recipes.length === 0) return []

    // No point running matches if the fridge is empty — everything is standard
    if (fridgeItems.length === 0) {
      return recipes.map(recipe => ({
        recipe,
        matches: [],
        missing: [],
        recalculated: null,
        tier: 'standard' as const,
      }))
    }

    setIsMatching(true)

    try {
      // Fetch total ingredient counts for all recipes in one query
      const recipeIds = recipes.map(r => r.id)
      const { data: ingredientCounts } = await supabase
        .from('recipe_ingredients')
        .select('recipe_id')
        .in('recipe_id', recipeIds)

      // Build a count map: recipe_id → total ingredient count
      const countMap = new Map<number, number>()
      for (const row of ingredientCounts ?? []) {
        countMap.set(row.recipe_id, (countMap.get(row.recipe_id) ?? 0) + 1)
      }

      // Fetch all ingredient names so we can compute missing list
      const { data: allIngredients } = await supabase
        .from('recipe_ingredients')
        .select('recipe_id, ingredient_name')
        .in('recipe_id', recipeIds)

      const ingredientsByRecipe = new Map<number, string[]>()
      for (const row of allIngredients ?? []) {
        const existing = ingredientsByRecipe.get(row.recipe_id) ?? []
        existing.push(row.ingredient_name)
        ingredientsByRecipe.set(row.recipe_id, existing)
      }

      // Run match_fridge_to_recipe for all recipes in parallel
      const matchResults = await Promise.all(
        recipes.map(async recipe => {
          const { data, error } = await supabase.rpc('match_fridge_to_recipe', {
            p_recipe_id: recipe.id,
          })
          if (error) {
            console.warn(`match_fridge_to_recipe failed for ${recipe.id}:`, error.message)
            return { recipeId: recipe.id, matches: [] as MatchResult[] }
          }
          return { recipeId: recipe.id, matches: (data ?? []) as MatchResult[] }
        })
      )

      // Build RecipeWithMatch for each recipe
      const results: RecipeWithMatch[] = recipes.map(recipe => {
        const { matches } = matchResults.find(r => r.recipeId === recipe.id)!
        const totalCount = countMap.get(recipe.id) ?? 0
        const allIngredientNames = ingredientsByRecipe.get(recipe.id) ?? []

        // Matched ingredient names (exact + likely only — high confidence)
        const matchedNames = new Set(
          matches
            .filter(m => m.match_tier === 'exact' || m.match_tier === 'likely')
            .map(m => m.ingredient_name)
        )

        // Missing = ingredients with no match at all
        const missing = allIngredientNames.filter(name => !matchedNames.has(name))

        // Tier based on fraction of high-confidence matches
        const matchFraction = totalCount > 0 ? matchedNames.size / totalCount : 0
        const tier: RecipeWithMatch['tier'] =
          matchedNames.size === 0 ? 'standard'
          : matchFraction >= FRIDGE_TIER_THRESHOLD ? 'fridge'
          : 'close'

        const recalculated = computeRecalculatedMacros(
          matches.filter(m => m.match_tier === 'exact' || m.match_tier === 'likely'),
          totalCount,
        )

        return { recipe, matches, missing, recalculated, tier }
      })

      // Sort: fridge first, then close, then standard; within tier keep original order
      results.sort((a, b) => {
        const order = { fridge: 0, close: 1, standard: 2 }
        return order[a.tier] - order[b.tier]
      })

      return results
    } finally {
      setIsMatching(false)
    }
  }

  return { matchRecipesToFridge, isMatching }
}
