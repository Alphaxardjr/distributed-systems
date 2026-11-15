
import { auth } from "../lib/firebase"
import { supabase } from "../lib/supabase"

export async function testFirebaseIdentity() {
  const user = auth.currentUser

  if (!user) {
    console.error("Please log in first.")
    return
  }

  const { data, error } = await supabase.rpc(
    "test_firebase_identity"
  )

  if (error) {
    console.error("Identity test failed:", error)
    return
  }

  console.log("Firebase UID:", user.uid)
  console.log("Supabase identity:", data)

  if (data?.user_id === user.uid) {
    console.log("Firebase identity verified!")
  } else {
    console.error("Firebase UID mismatch.")
  }
}
