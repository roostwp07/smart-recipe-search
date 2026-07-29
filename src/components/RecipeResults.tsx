import type { Recipe } from '../lib/database.types'
import type { MacroTargets } from '../hooks/useRecipeSearch'

// These must match the RPC defaults
const CAL_TOLERANCE = 100
const MACRO_TOLERANCE = 15

interface RecipeResultsProps {
  recipes: Recipe[]
  isLoading: boolean
  error: string | null
  hasSearched: boolean
  lastTargets: MacroTargets | null
}

function toleranceSummary(targets: MacroTargets): string {
  const parts: string[] = []
  if (targets.calories != null) parts.push(`±${CAL_TOLERANCE} kcal`)
  if (targets.protein != null || targets.carbs != null || targets.fat != null) {
    parts.push(`±${MACRO_TOLERANCE}g macros`)
  }
  return parts.join(', ')
}

function RecipeResults({ recipes, isLoading, error, hasSearched, lastTargets }: RecipeResultsProps) {
  if (isLoading) {
    return <p className="recipe-status">Searching recipes…</p>
  }

  if (error) {
    return <p className="recipe-status recipe-status--error" role="alert">{error}</p>
  }

  if (!hasSearched) {
    return null
  }

  if (recipes.length === 0) {
    return (
      <p className="recipe-status">
        No recipes found matching those targets. Try loosening your numbers.
      </p>
    )
  }

  const tolerance = lastTargets ? toleranceSummary(lastTargets) : null

  return (
    <>
      <p className="recipe-count">
        {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} found
        {tolerance ? ` (${tolerance})` : ''}
      </p>
      <ul className="recipe-list">
        {recipes.map(recipe => (
          <li key={recipe.id} className="recipe-card">
            {recipe.image_url && (
              <img
                className="recipe-image"
                src={recipe.image_url}
                alt={recipe.title}
                loading="lazy"
              />
            )}
            <div className="recipe-body">
              <h3 className="recipe-title">{recipe.title}</h3>

              <div className="recipe-macros">
                {recipe.calories != null && (
                  <span>{Math.round(recipe.calories)} kcal</span>
                )}
                {recipe.protein_g != null && (
                  <span>{recipe.protein_g.toFixed(1)}g protein</span>
                )}
                {recipe.carbs_g != null && (
                  <span>{recipe.carbs_g.toFixed(1)}g carbs</span>
                )}
                {recipe.fat_g != null && (
                  <span>{recipe.fat_g.toFixed(1)}g fat</span>
                )}
                {recipe.fiber_g != null && (
                  <span>{recipe.fiber_g.toFixed(1)}g fiber</span>
                )}
              </div>

              <div className="recipe-meta">
                {recipe.ready_in_minutes != null && (
                  <span>⏱ {recipe.ready_in_minutes} min</span>
                )}
                {recipe.aggregate_likes != null && (
                  <span>♥ {recipe.aggregate_likes}</span>
                )}
                {recipe.spoonacular_score != null && (
                  <span>Score: {Math.round(recipe.spoonacular_score)}</span>
                )}
                {recipe.servings != null && (
                  <span>{recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</span>
                )}
              </div>

              {recipe.source_url && (
                <a
                  className="recipe-link"
                  href={recipe.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View recipe →
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

export default RecipeResults
