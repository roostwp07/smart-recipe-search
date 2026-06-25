export type FridgeItem = {
  id: number
  food_id: number
  quantity: number
  unit: string
  date_added: string
  expiry_date: string | null
  food_name: string
  food_brand: string | null
  serving_size_g: number | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  sodium_mg: number | null
}

export type Database = {
  public: {
    Tables: {
      foods: {
        Row: {
          id: number
          name: string
          brand: string | null
          barcode: string | null
          serving_size_g: number | null
          calories: number | null
          protein_g: number | null
          carbs_g: number | null
          fat_g: number | null
          fiber_g: number | null
          sodium_mg: number | null
        }
        Insert: {
          name: string
          brand?: string | null
          barcode?: string | null
          serving_size_g?: number | null
          calories?: number | null
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          sodium_mg?: number | null
        }
        Update: {
          name?: string
          brand?: string | null
          barcode?: string | null
          serving_size_g?: number | null
          calories?: number | null
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          sodium_mg?: number | null
        }
        Relationships: []
      }
      fridge_items: {
        Row: {
          id: number
          food_id: number
          quantity: number
          unit: string
          date_added: string
          expiry_date: string | null
        }
        Insert: {
          food_id: number
          quantity: number
          unit: string
          date_added?: string
          expiry_date?: string | null
        }
        Update: {
          food_id?: number
          quantity?: number
          unit?: string
          date_added?: string
          expiry_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fridge_items_food_id_fkey'
            columns: ['food_id']
            isOneToOne: false
            referencedRelation: 'foods'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      search_foods: {
        Args: { query: string; max_results?: number }
        Returns: {
          id: number
          name: string
          brand: string | null
          barcode: string | null
          serving_size_g: number | null
          calories: number | null
          protein_g: number | null
          carbs_g: number | null
          fat_g: number | null
          fiber_g: number | null
          sodium_mg: number | null
        }[]
      }
      get_fridge: {
        Args: Record<string, never>
        Returns: FridgeItem[]
      }
    }
  }
}
