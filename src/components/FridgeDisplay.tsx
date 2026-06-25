import type { FridgeItem } from '../lib/database.types'

interface FridgeDisplayProps {
  items: FridgeItem[]
  isLoading: boolean
  onRemove: (id: number) => void
}

function FridgeDisplay({ items, isLoading, onRemove }: FridgeDisplayProps) {
  if (isLoading) return <p className="fridge-status">Loading fridge…</p>
  if (items.length === 0) return <p className="fridge-status">Your fridge is empty.</p>

  return (
    <ul className="fridge-list">
      {items.map(item => (
        <li key={item.id} className="fridge-item">
          <div className="fridge-item-header">
            <div className="fridge-item-title">
              <span className="food-name">{item.food_name}</span>
              {item.food_brand && <span className="food-brand">{item.food_brand}</span>}
            </div>
            <button type="button" className="remove-btn" onClick={() => onRemove(item.id)}>
              Remove
            </button>
          </div>

          <div className="fridge-item-meta">
            <span>{item.quantity} {item.unit}</span>
            <span>Added {item.date_added}</span>
            {item.expiry_date && <span>Expires {item.expiry_date}</span>}
          </div>

          <div className="fridge-item-macros">
            {item.calories != null && <span>{item.calories} kcal</span>}
            {item.protein_g != null && <span>{item.protein_g}g protein</span>}
            {item.carbs_g != null && <span>{item.carbs_g}g carbs</span>}
            {item.fat_g != null && <span>{item.fat_g}g fat</span>}
            {item.fiber_g != null && <span>{item.fiber_g}g fiber</span>}
            {item.sodium_mg != null && <span>{item.sodium_mg}mg sodium</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default FridgeDisplay
