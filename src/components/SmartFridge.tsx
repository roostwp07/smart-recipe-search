import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { SupabaseContext } from '../lib/supabase-context'
import type { Database, FridgeItem } from '../lib/database.types'
import { useFridge } from '../hooks/useFridge'
import { useRecipeSearch } from '../hooks/useRecipeSearch'
import FoodSearch from './FoodSearch'
import type { Food } from './FoodSearch'
import AddItemForm from './AddItemForm'
import FridgeDisplay from './FridgeDisplay'
import MacroTargetForm from './MacroTargetForm'
import RecipeResults from './RecipeResults'
import './SmartFridge.css'

export interface SmartFridgeProps {
  supabaseUrl: string
  supabaseAnonKey: string
  onItemAdded?: (item: FridgeItem) => void
  onItemRemoved?: (id: number) => void
}

type Mode = 'closed' | 'open'

// Inner component so hooks run inside the context provider
function FridgeRoot({ onItemAdded, onItemRemoved }: Pick<SmartFridgeProps, 'onItemAdded' | 'onItemRemoved'>) {
  const { items, isLoading, addItem, removeItem } = useFridge()
  const { recipes: _recipes, tieredRecipes, isLoading: recipesLoading, error: recipesError, search, reset, hasSearched, lastTargets } = useRecipeSearch()
  const [pendingFood, setPendingFood] = useState<Food | null>(null)
  const [mode, setMode] = useState<Mode>('closed')

  async function handleConfirmAdd(quantity: number, unit: string, expiryDate?: string) {
    if (!pendingFood) return
    const added = await addItem(pendingFood, quantity, unit, expiryDate)
    if (added) onItemAdded?.(added)
    setPendingFood(null)
  }

  async function handleRemove(id: number) {
    await removeItem(id)
    onItemRemoved?.(id)
  }

  function openFridge() {
    setMode('open')
  }

  function closeFridge() {
    setMode('closed')
    reset()
  }

  // Sum fridge item macros for pre-fill suggestion
  const fridgeMacros = items.length > 0 ? {
    calories: items.reduce((sum, i) => sum + (i.calories ?? 0), 0),
    protein: items.reduce((sum, i) => sum + (i.protein_g ?? 0), 0),
    carbs: items.reduce((sum, i) => sum + (i.carbs_g ?? 0), 0),
    fat: items.reduce((sum, i) => sum + (i.fat_g ?? 0), 0),
  } : undefined

  const isOpen = mode === 'open'

  return (
    <div className={`fridge-scene${isOpen ? ' fridge-scene--open' : ''}`}>
      {/* ── Interior (behind the door, always rendered) ── */}
      <div className="fridge-interior-panel" aria-hidden={!isOpen}>
        <div className="fridge-interior-shelf">
          <MacroTargetForm onSearch={(targets) => search(targets, items)} isLoading={recipesLoading} fridgeMacros={fridgeMacros} />
          <RecipeResults
            tieredRecipes={tieredRecipes}
            isLoading={recipesLoading}
            error={recipesError}
            hasSearched={hasSearched}
            lastTargets={lastTargets}
          />
        </div>
        <button
          type="button"
          className="fridge-close-btn"
          onClick={closeFridge}
          aria-label="Close fridge"
        >
          Close
        </button>
      </div>

      {/* ── Door (swings open on left hinge) ── */}
      <div className={`fridge-door${isOpen ? ' fridge-door--open' : ''}`}>
        {/* Door screen — the V1 UI embedded in the door */}
        <div className="fridge-door-screen">
          <FoodSearch onFoodSelected={setPendingFood} />
          {pendingFood && (
            <AddItemForm
              food={pendingFood}
              onConfirm={handleConfirmAdd}
              onCancel={() => setPendingFood(null)}
            />
          )}
          <FridgeDisplay items={items} isLoading={isLoading} onRemove={handleRemove} />
        </div>

        {/* Handle — right edge of door, triggers open */}
        <button
          type="button"
          className="fridge-handle"
          onClick={openFridge}
          aria-label="Open fridge to find recipes"
          tabIndex={isOpen ? -1 : 0}
        />
      </div>
    </div>
  )
}

function SmartFridge({ supabaseUrl, supabaseAnonKey, onItemAdded, onItemRemoved }: SmartFridgeProps) {
  const [client] = useState(() => createClient<Database>(supabaseUrl, supabaseAnonKey))

  return (
    <SupabaseContext.Provider value={client}>
      <FridgeRoot onItemAdded={onItemAdded} onItemRemoved={onItemRemoved} />
    </SupabaseContext.Provider>
  )
}

export default SmartFridge
