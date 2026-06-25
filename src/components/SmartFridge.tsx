import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { SupabaseContext } from '../lib/supabase-context'
import type { Database, FridgeItem } from '../lib/database.types'
import { useFridge } from '../hooks/useFridge'
import FoodSearch from './FoodSearch'
import type { Food } from './FoodSearch'
import AddItemForm from './AddItemForm'
import FridgeDisplay from './FridgeDisplay'

export interface SmartFridgeProps {
  supabaseUrl: string
  supabaseAnonKey: string
  onItemAdded?: (item: FridgeItem) => void
  onItemRemoved?: (id: number) => void
}

// Inner component so hooks run inside the context provider
function FridgeRoot({ onItemAdded, onItemRemoved }: Pick<SmartFridgeProps, 'onItemAdded' | 'onItemRemoved'>) {
  const { items, isLoading, addItem, removeItem } = useFridge()
  const [pendingFood, setPendingFood] = useState<Food | null>(null)

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

  return (
    <div className="smart-fridge">
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
