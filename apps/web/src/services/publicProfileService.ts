
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore"

import { updateProfile } from "firebase/auth"
import { auth, db } from "../lib/firebase"

export interface PublicProfile {
  uid: string
  displayName: string
  displayNameLower: string
  bio: string
  avatarPath: string | null
}

const MAX_NAME_LENGTH = 50
const MAX_BIO_LENGTH = 200

function requireUser() {
  const user = auth.currentUser

  if (!user) {
    throw new Error("Not authenticated")
  }

  return user
}

export function normalizeDisplayName(name: string) {
  return name
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

function cleanDisplayName(name: string) {
  return name
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
}

// ========================================
// INITIALIZE PUBLIC PROFILE
// ========================================

export async function ensurePublicProfile():
  Promise<void> {
  const user = requireUser()

  const publicRef = doc(
    db,
    "publicProfiles",
    user.uid
  )

  const privateRef = doc(
    db,
    "users",
    user.uid
  )

  const privateSnapshot = await getDoc(privateRef)

  if (!privateSnapshot.exists()) {
    throw new Error(
      "Private user profile not found."
    )
  }

  const privateData = privateSnapshot.data()

  const displayName = cleanDisplayName(
    String(
      privateData.displayName ||
      user.displayName ||
      ""
    )
  )

  if (
    !displayName ||
    displayName.length > MAX_NAME_LENGTH
  ) {
    throw new Error(
      "Display name must be 1–50 characters."
    )
  }

  const bio = String(privateData.bio ?? "")
    .trim()
    .slice(0, MAX_BIO_LENGTH)

  // Transaction prevents two simultaneous
  // initialization calls from overwriting
  // an existing profile.
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(publicRef)

    if (existing.exists()) {
      return
    }

    transaction.set(publicRef, {
      displayName,
      displayNameLower:
        normalizeDisplayName(displayName),
      bio,
      avatarPath: null,
      updatedAt: serverTimestamp(),
    })
  })
}

// ========================================
// UPDATE PUBLIC + PRIVATE PROFILES
// ========================================

export async function updatePublicProfile(
  updates: {
    displayName?: string
    bio?: string
  }
): Promise<void> {
  const user = requireUser()

  // Create profile automatically if missing.
  await ensurePublicProfile()

  const publicRef = doc(
    db,
    "publicProfiles",
    user.uid
  )

  const privateRef = doc(
    db,
    "users",
    user.uid
  )

  const publicChanges: Record<string, unknown> = {}
  const privateChanges: Record<string, unknown> = {}

  if (updates.displayName !== undefined) {
    const displayName = cleanDisplayName(
      updates.displayName
    )

    if (
      !displayName ||
      displayName.length > MAX_NAME_LENGTH
    ) {
      throw new Error(
        "Display name must be 1–50 characters."
      )
    }

    publicChanges.displayName = displayName
    publicChanges.displayNameLower =
      normalizeDisplayName(displayName)

    privateChanges.displayName = displayName
  }

  if (updates.bio !== undefined) {
    const bio = updates.bio.trim()

    if (bio.length > MAX_BIO_LENGTH) {
      throw new Error(
        "Bio must be 200 characters or less."
      )
    }

    publicChanges.bio = bio
    privateChanges.bio = bio
  }

  if (Object.keys(publicChanges).length === 0) {
    return
  }

  const batch = writeBatch(db)

  batch.update(publicRef, {
    ...publicChanges,
    updatedAt: serverTimestamp(),
  })

  batch.update(privateRef, {
    ...privateChanges,
    updatedAt: serverTimestamp(),
  })

  await batch.commit()

  // Keep Firebase Authentication display name
  // synchronized with Firestore.
  if (typeof publicChanges.displayName === "string") {
    await updateProfile(user, {
      displayName: publicChanges.displayName,
    })
  }
}

// ========================================
// SEARCH PUBLIC PROFILES
// ========================================

export async function searchPublicProfiles(
  searchText: string,
  pageSize = 20
): Promise<PublicProfile[]> {
  const user = requireUser()

  const term = normalizeDisplayName(searchText)

  if (term.length < 2) {
    return []
  }

  const requestedSize = Math.min(
    Math.max(Math.floor(pageSize) || 20, 1),
    50
  )

  const snapshot = await getDocs(
    query(
      collection(db, "publicProfiles"),
      where("displayNameLower", ">=", term),
      where("displayNameLower", "<=", term + "\uf8ff"),
      limit(requestedSize + 1)
    )
  )

  return snapshot.docs
    .filter((document) => {
      return document.id !== user.uid
    })
    .slice(0, requestedSize)
    .map((document) => {
      const data = document.data()

      return {
        uid: document.id,
        displayName: data.displayName,
        displayNameLower: data.displayNameLower,
        bio: data.bio,
        avatarPath: data.avatarPath ?? null,
      }
    })
}
