import SmartFridge from './components/SmartFridge'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

function App() {
  return <SmartFridge supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey} />
}

export default App
