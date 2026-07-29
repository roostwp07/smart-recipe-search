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

export type RecipeIngredient = {
  id: number
  recipe_id: number
  spoonacular_ingredient_id: number | null
  ingredient_name: string
  amount_metric: number | null
  unit_metric: string | null
}

export type MatchTier = 'exact' | 'likely' | 'possible'

/** One row returned by match_fridge_to_recipe() */
export type MatchResult = {
  ingredient_name: string
  amount_metric: number | null
  unit_metric: string | null
  fridge_item_id: number
  fridge_food_id: number
  fridge_food_name: string
  calories_per_100g: number | null
  protein_per_100g: number | null
  carbs_per_100g: number | null
  fat_per_100g: number | null
  fiber_per_100g: number | null
  match_tier: MatchTier
  containment_score: number
  trigram_score: number
}

/** Macros recalculated from the user's actual fridge products */
export type RecalculatedMacros = {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  /** Number of ingredients that contributed to this calculation */
  matched_count: number
  /** Total ingredients in the recipe */
  total_count: number
}

/** A recipe enriched with fridge match data */
export type RecipeWithMatch = {
  recipe: Recipe
  matches: MatchResult[]
  /** Ingredients in the recipe that had no fridge match */
  missing: string[]
  /** Recalculated macros from matched fridge items (null if no matches) */
  recalculated: RecalculatedMacros | null
  /**
   * 'fridge'  — ≥75% of ingredients matched at exact/likely
   * 'close'   — some matches but below fridge threshold
   * 'standard'— no fridge items matched
   */
  tier: 'fridge' | 'close' | 'standard'
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

// ─── Spoonacular informationBulk response types ──────────────────────────────

export interface SpoonacularMetricMeasure {
  amount: number
  unitShort: string
  unitLong: string
}

export interface SpoonacularMeasures {
  metric: SpoonacularMetricMeasure
  us: SpoonacularMetricMeasure
}

export interface SpoonacularExtendedIngredient {
  id: number
  name: string           // generic name, e.g. "cottage cheese"
  originalName: string   // name as written in recipe
  amount: number
  unit: string
  measures: SpoonacularMeasures
}

/** Shape of one recipe from GET /recipes/informationBulk */
export interface SpoonacularRecipeInfo {
  id: number
  extendedIngredients: SpoonacularExtendedIngredient[]
}

// ─── Database schema ──────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      recipes: {
        Row: Recipe
        Insert: Omit<Recipe, 'cached_at'> & { cached_at?: string }
        Update: Partial<Omit<Recipe, 'id'>>
        Relationships: []
      }
      recipe_ingredients: {
        Row: RecipeIngredient
        Insert: Omit<RecipeIngredient, 'id'>
        Update: Partial<Omit<RecipeIngredient, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'recipe_ingredients_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          }
        ]
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
      get_recipe_ingredients: {
        Args: { p_recipe_id: number }
        Returns: RecipeIngredient[]
      }
      match_fridge_to_recipe: {
        Args: { p_recipe_id: number }
        Returns: MatchResult[]
      }
    }
  }
}
