import { useState } from 'react'
import type { Food } from './FoodSearch'

interface AddItemFormProps {
  food: Food
  onConfirm: (quantity: number, unit: string, expiryDate?: string) => void
  onCancel: () => void
}

function AddItemForm({ food, onConfirm, onCancel }: AddItemFormProps) {
  const [quantity, setQuantity] = useState(1)
  const [unit, setUnit] = useState('serving')
  const [expiryDate, setExpiryDate] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onConfirm(quantity, unit, expiryDate || undefined)
  }

  return (
    <form onSubmit={handleSubmit} className="add-item-form">
      <p>
        Adding: <strong>{food.name}{food.brand ? ` (${food.brand})` : ''}</strong>
      </p>
      <label>
        Quantity
        <input
          type="number"
          min={0.1}
          step={0.1}
          value={quantity}
          onChange={e => setQuantity(Number(e.target.value))}
          required
        />
      </label>
      <label>
        Unit
        <input
          type="text"
          value={unit}
          onChange={e => setUnit(e.target.value)}
          required
        />
      </label>
      <label>
        Expiry date (optional)
        <input
          type="date"
          value={expiryDate}
          onChange={e => setExpiryDate(e.target.value)}
        />
      </label>
      <div className="add-item-actions">
        <button type="submit">Add to fridge</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export default AddItemForm
