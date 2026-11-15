
import type { Timestamp } from "firebase/firestore"

export interface ChatUser {
  uid: string
  displayName: string
  email: string
  photoURL: string | null
  bio: string
  createdAt: Timestamp
  updatedAt?: Timestamp
}

export interface UserProfileUpdate {
  displayName?: string
  bio?: string
}
