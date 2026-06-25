import { createContext, useContext } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export const SupabaseContext = createContext<SupabaseClient<Database> | null>(null)

export function useSupabase() {
  const client = useContext(SupabaseContext)
  if (!client) throw new Error('useSupabase must be used inside SmartFridge')
  return client
}
