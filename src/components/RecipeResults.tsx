import type { RecipeWithMatch } from '../lib/database.types'
import type { MacroTargets } from '../hooks/useRecipeSearch'

// These must match the RPC defaults
const CAL_TOLERANCE = 100
const MACRO_TOLERANCE = 15

interface RecipeResultsProps {
  tieredRecipes: RecipeWithMatch[]
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

function RecipeCard({ rw }: { rw: RecipeWithMatch }) {
  const { recipe, recalculated, missing, tier } = rw

  // Use recalculated macros if available, otherwise fall back to Spoonacular values
  const calories  = recalculated?.calories  ?? recipe.calories
  const protein   = recalculated?.protein_g ?? recipe.protein_g
  const carbs     = recalculated?.carbs_g   ?? recipe.carbs_g
  const fat       = recalculated?.fat_g     ?? recipe.fat_g
  const fiber     = recipe.fiber_g
  const isRecalculated = recalculated != null

  return (
    <li className={`recipe-card recipe-card--${tier}`}>
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
          {calories != null && (
            <span>{Math.round(calories)} kcal</span>
          )}
          {protein != null && (
            <span>{Number(protein).toFixed(1)}g protein</span>
          )}
          {carbs != null && (
            <span>{Number(carbs).toFixed(1)}g carbs</span>
          )}
          {fat != null && (
            <span>{Number(fat).toFixed(1)}g fat</span>
          )}
          {fiber != null && (
            <span>{Number(fiber).toFixed(1)}g fiber</span>
          )}
          {isRecalculated && (
            <span className="recipe-macros-source" title="Calculated from your fridge items">
              📊 your products ({recalculated.matched_count}/{recalculated.total_count} ingredients)
            </span>
          )}
        </div>

        {tier === 'close' && missing.length > 0 && (
          <div className="recipe-missing">
            <span className="recipe-missing-label">Need: </span>
            {missing.slice(0, 5).join(', ')}
            {missing.length > 5 && ` +${missing.length - 5} more`}
          </div>
        )}

        <div className="recipe-meta">
          {recipe.ready_in_minutes != null && (
            <span>⏱ {recipe.ready_in_minutes} min</span>
          )}
          {recipe.aggregate_likes != null && (
            <span>♥ {recipe.aggregate_likes}</span>
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
  )
}

function TierSection({
  label,
  emoji,
  recipes,
}: {
  label: string
  emoji: string
  recipes: RecipeWithMatch[]
}) {
  if (recipes.length === 0) return null
  return (
    <section className="recipe-tier">
      <h2 className="recipe-tier-heading">{emoji} {label}</h2>
      <ul className="recipe-list">
        {recipes.map(rw => (
          <RecipeCard key={rw.recipe.id} rw={rw} />
        ))}
      </ul>
    </section>
  )
}

function RecipeResults({ tieredRecipes, isLoading, error, hasSearched, lastTargets }: RecipeResultsProps) {
  if (isLoading) {
    return <p className="recipe-status">Searching recipes…</p>
  }

  if (error) {
    return <p className="recipe-status recipe-status--error" role="alert">{error}</p>
  }

  if (!hasSearched) {
    return null
  }

  if (tieredRecipes.length === 0) {
    return (
      <p className="recipe-status">
        No recipes found matching those targets. Try loosening your numbers.
      </p>
    )
  }

  const tolerance = lastTargets ? toleranceSummary(lastTargets) : null
  const fridgeRecipes    = tieredRecipes.filter(r => r.tier === 'fridge')
  const closeRecipes     = tieredRecipes.filter(r => r.tier === 'close')
  const standardRecipes  = tieredRecipes.filter(r => r.tier === 'standard')
  const hasFridgeTiers   = fridgeRecipes.length > 0 || closeRecipes.length > 0

  return (
    <>
      <p className="recipe-count">
        {tieredRecipes.length} recipe{tieredRecipes.length !== 1 ? 's' : ''} found
        {tolerance ? ` (${tolerance})` : ''}
      </p>

      {hasFridgeTiers ? (
        <>
          <TierSection label="In your fridge"  emoji="🧊" recipes={fridgeRecipes} />
          <TierSection label="Close match"      emoji="🛒" recipes={closeRecipes} />
          {standardRecipes.length > 0 && (
            <TierSection label="Other recipes"  emoji="📋" recipes={standardRecipes} />
          )}
        </>
      ) : (
        <TierSection label="Recipes" emoji="📋" recipes={standardRecipes} />
      )}
    </>
  )
}

export default RecipeResults
