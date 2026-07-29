export type Recipe = {
  id: number
  title: string
  image_url: string | null
  source_url: string | null
  ready_in_minutes: number | null
  servings: number | null
  aggregate_likes: number | null
  spoonacular_score: number | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  cached_at: string
}

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
      recipes: {
        Row: Recipe
        Insert: Omit<Recipe, 'cached_at'> & { cached_at?: string }
        Update: Partial<Omit<Recipe, 'id'>>
        Relationships: []
      }
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
          image_url: string | null
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
          image_url?: string | null
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
          image_url?: string | null
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
      search_recipes: {
        Args: {
          target_cal?: number | null
          target_protein?: number | null
          target_carbs?: number | null
          target_fat?: number | null
          cal_tolerance?: number
          macro_tolerance?: number
          max_results?: number
        }
        Returns: Recipe[]
      }
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
          image_url: string | null
        }[]
      }
      get_fridge: {
        Args: Record<string, never>
        Returns: FridgeItem[]
      }
    }
  }
}
