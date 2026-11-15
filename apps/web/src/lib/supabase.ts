import { createClient } from "@supabase/supabase-js"
import { auth } from "./firebase"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase configuration")
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  accessToken: async () => {
    const user = auth.currentUser
    return user ? user.getIdToken() : null
  },
})