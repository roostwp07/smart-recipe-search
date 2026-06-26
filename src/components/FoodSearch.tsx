import { useState, useEffect, useRef } from 'react'
import { useSupabase } from '../lib/supabase-context'
import type { Database } from '../lib/database.types'

export type Food = Database['public']['Tables']['foods']['Row']

interface FoodSearchProps {
  onFoodSelected: (food: Food) => void
}

function FoodSearch({ onFoodSelected }: FoodSearchProps) {
  const supabase = useSupabase()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.trim().length < 1) {
      setResults([])
      setIsOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      const { data, error } = await supabase.rpc('search_foods', { query: query.trim() })
      setIsLoading(false)

      if (!error && data) {
        setResults(data)
        setIsOpen(true)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  function handleSelect(food: Food) {
    onFoodSelected(food)
    setQuery('')
    setResults([])
    setIsOpen(false)
  }

  return (
    <div className="food-search">
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search foods…"
        aria-label="Search foods"
        aria-expanded={isOpen}
        aria-autocomplete="list"
      />
      {isLoading && <p className="food-search-status">Searching…</p>}
      {isOpen && results.length === 0 && !isLoading && (
        <p className="food-search-status">No results for "{query}"</p>
      )}
      {isOpen && results.length > 0 && (
        <ul className="food-search-results" role="listbox">
          {results.map(food => (
            <li key={food.id} role="option">
              <button type="button" onClick={() => handleSelect(food)}>
                <span className="food-name">{food.name}</span>
                {food.brand && <span className="food-brand">{food.brand}</span>}
                <span className="food-macros">
                  {food.calories != null && `${Math.round(food.calories)} kcal`}
                  {food.protein_g != null && ` · ${food.protein_g.toFixed(1)}g protein`}
                  {food.carbs_g != null && ` · ${food.carbs_g.toFixed(1)}g carbs`}
                  {food.fat_g != null && ` · ${food.fat_g.toFixed(1)}g fat`}
                  <span className="food-serving"> per 100g</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default FoodSearch
