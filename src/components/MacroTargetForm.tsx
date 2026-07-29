import { useState } from 'react'
import type { MacroTargets } from '../hooks/useRecipeSearch'

interface FridgeMacros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface MacroTargetFormProps {
  onSearch: (targets: MacroTargets) => void
  isLoading: boolean
  fridgeMacros?: FridgeMacros
}

function MacroTargetForm({ onSearch, isLoading, fridgeMacros }: MacroTargetFormProps) {
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const targets: MacroTargets = {
      calories: calories !== '' ? Number(calories) : undefined,
      protein: protein !== '' ? Number(protein) : undefined,
      carbs: carbs !== '' ? Number(carbs) : undefined,
      fat: fat !== '' ? Number(fat) : undefined,
    }

    // At least one target required
    if (Object.values(targets).every(v => v == null)) {
      setValidationError('Enter at least one macro target.')
      return
    }

    setValidationError(null)
    onSearch(targets)
  }

  function prefillFromFridge() {
    if (!fridgeMacros) return
    setCalories(Math.round(fridgeMacros.calories).toString())
    setProtein(Math.round(fridgeMacros.protein).toString())
    setCarbs(Math.round(fridgeMacros.carbs).toString())
    setFat(Math.round(fridgeMacros.fat).toString())
    setValidationError(null)
  }

  const hasFridgeMacros = fridgeMacros != null && (
    fridgeMacros.calories > 0 ||
    fridgeMacros.protein > 0 ||
    fridgeMacros.carbs > 0 ||
    fridgeMacros.fat > 0
  )

  return (
    <form onSubmit={handleSubmit} className="macro-target-form">
      <h2>Find recipes by macros</h2>
      <p className="macro-form-hint">Fill in any targets — leave the rest blank.</p>

      {hasFridgeMacros && (
        <button
          type="button"
          className="prefill-btn"
          onClick={prefillFromFridge}
        >
          Use fridge macros (~{Math.round(fridgeMacros!.calories)} kcal · {Math.round(fridgeMacros!.protein)}g protein)
        </button>
      )}

      <div className="macro-inputs">
        <label>
          Calories (kcal)
          <input
            type="number"
            min={0}
            step={10}
            value={calories}
            onChange={e => setCalories(e.target.value)}
            placeholder="e.g. 600"
          />
        </label>

        <label>
          Protein (g)
          <input
            type="number"
            min={0}
            step={1}
            value={protein}
            onChange={e => setProtein(e.target.value)}
            placeholder="e.g. 40"
          />
        </label>

        <label>
          Carbs (g)
          <input
            type="number"
            min={0}
            step={1}
            value={carbs}
            onChange={e => setCarbs(e.target.value)}
            placeholder="e.g. 60"
          />
        </label>

        <label>
          Fat (g)
          <input
            type="number"
            min={0}
            step={1}
            value={fat}
            onChange={e => setFat(e.target.value)}
            placeholder="e.g. 20"
          />
        </label>
      </div>

      {validationError && (
        <p className="macro-form-error" role="alert">{validationError}</p>
      )}

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Searching…' : 'Search recipes'}
      </button>
    </form>
  )
}

export default MacroTargetForm
