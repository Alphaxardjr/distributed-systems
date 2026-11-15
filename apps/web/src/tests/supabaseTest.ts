import { supabase } from "../lib/supabase"
import { auth } from "../lib/firebase"

export async function testSupabaseConnection() {
  const user = auth.currentUser

  if (!user) {
    console.error("Sign in to Chatly first.")
    return
  }

  const { data, error } = await supabase.storage
    .from("chat-attachments")
    .list("", { limit: 10 })

  if (error) {
    console.error("Storage access:", error.message)
    return
  }

  console.log("Storage request successful!")
  console.log("Visible files:", data)
}