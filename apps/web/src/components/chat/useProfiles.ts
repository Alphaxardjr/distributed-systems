import { useEffect, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "../../lib/firebase"
import type { PublicProfile } from "../../services/publicProfileService"
import { errorText } from "./feedback"

// Public profile reads only; profile writes go through publicProfileService.
export function useProfiles(ids: string[], retry = 0) {
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const key = [...new Set(ids)].sort().join(",")
  useEffect(() => {
    const subscriptions = key
      .split(",")
      .filter(Boolean)
      .map((uid) =>
        onSnapshot(
          doc(db, "publicProfiles", uid),
          (snapshot) => {
            setErrors((current) => ({ ...current, [uid]: "" }))
            setProfiles((current) => ({
              ...current,
              [uid]: snapshot.exists()
                ? ({ ...snapshot.data(), uid } as PublicProfile)
                : {
                    uid,
                    displayName: "Unavailable profile",
                    bio: "",
                    displayNameLower: "",
                    avatarPath: null,
                  },
            }))
          },
          (reason) =>
            setErrors((current) => ({ ...current, [uid]: errorText(reason) }))
        )
      )
    return () => subscriptions.forEach((stop) => stop())
  }, [key, retry])
  return {
    profiles,
    error: key
      .split(",")
      .map((uid) => errors[uid])
      .filter(Boolean)
      .join(" "),
  }
}
