import { useState, useRef, useEffect } from 'react'
import type { Food } from './FoodSearch'

const UNIT_OPTIONS = [
  'serving', 'g', 'kg', 'oz', 'lb', 'ml', 'L',
  'cup', 'tbsp', 'tsp', 'piece', 'slice', 'can',
  'bottle', 'bag', 'box', 'scoop', 'packet',
]

interface AddItemFormProps {
  food: Food
  onConfirm: (quantity: number, unit: string, expiryDate?: string) => void
  onCancel: () => void
}

function AddItemForm({ food, onConfirm, onCancel }: AddItemFormProps) {
  const [quantity, setQuantity] = useState(1)
  const [unit, setUnit] = useState('serving')
  const [expiryDate, setExpiryDate] = useState('')
  const [unitOpen, setUnitOpen] = useState(false)
  const unitRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (unitRef.current && !unitRef.current.contains(e.target as Node)) {
        setUnitOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
        <div className="unit-combobox" ref={unitRef}>
          <input
            type="text"
            value={unit}
            onChange={e => setUnit(e.target.value)}
            onFocus={() => setUnitOpen(true)}
            required
          />
          <button
            type="button"
            className="unit-toggle"
            tabIndex={-1}
            aria-label="Show unit options"
            onClick={() => setUnitOpen(o => !o)}
          >
            ▾
          </button>
          {unitOpen && (
            <ul className="unit-dropdown">
              {UNIT_OPTIONS.map(u => (
                <li key={u}>
                  <button
                    type="button"
                    onClick={() => { setUnit(u); setUnitOpen(false) }}
                  >
                    {u}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
