import { useState, useEffect } from 'react'
import { useSupabase } from '../lib/supabase-context'
import type { FridgeItem } from '../lib/database.types'
import type { Food } from '../components/FoodSearch'

export function useFridge() {
  const supabase = useSupabase()
  const [items, setItems] = useState<FridgeItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  async function fetchItems(): Promise<FridgeItem[]> {
    const { data, error } = await supabase.rpc('get_fridge')
    const fetched = !error && data ? data : []
    setItems(fetched)
    setIsLoading(false)
    return fetched
  }

  useEffect(() => { fetchItems() }, [])

  async function addItem(
    food: Food,
    quantity: number,
    unit: string,
    expiryDate?: string,
  ): Promise<FridgeItem | null> {
    const { data: inserted, error } = await supabase
      .from('fridge_items')
      .insert({
        food_id: food.id,
        quantity,
        unit,
        date_added: new Date().toISOString().split('T')[0],
        expiry_date: expiryDate ?? null,
      })
      .select('id')
      .single()

    if (error || !inserted) return null
    const refreshed = await fetchItems()
    return refreshed.find(i => i.id === inserted.id) ?? null
  }

  async function removeItem(id: number) {
    const { error } = await supabase.from('fridge_items').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(item => item.id !== id))
  }

  return { items, isLoading, addItem, removeItem }
}
