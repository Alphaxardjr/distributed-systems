
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore"

import { auth, db } from "../lib/firebase"
import { supabase } from "../lib/supabase"

import {
  ensurePublicProfile,
} from "./publicProfileService"

const FUNCTION_NAME = "profile-avatar"
const BUCKET = "chat-attachments"

const MAX_FILE_SIZE = 5 * 1024 * 1024

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
])

interface UploadAuthorization {
  path: string
  token: string
}

interface AvatarUrlResponse {
  url: string | null
}

interface DeleteResponse {
  success: boolean
}

// ========================================
// AUTHENTICATION
// ========================================

function requireUser() {
  const user = auth.currentUser

  if (!user) {
    throw new Error("You must be logged in.")
  }

  return user
}

// ========================================
// CALL SUPABASE EDGE FUNCTION
// ========================================

async function callAvatarFunction<T>(
  body: Record<string, unknown>
): Promise<T> {
  const user = requireUser()

  const firebaseToken = await user.getIdToken()

  const { data, error } =
    await supabase.functions.invoke(
      FUNCTION_NAME,
      {
        body,
        headers: {
          Authorization: `Bearer ${firebaseToken}`,
        },
      }
    )

  if (error) {
    let details = error.message

    if (
      "context" in error &&
      error.context instanceof Response
    ) {
      const responseBody =
        await error.context.clone().text()

      if (responseBody) {
        details += ` | Response: ${responseBody}`
      }
    }

    throw new Error(details)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return data as T
}

// ========================================
// VALIDATE IMAGE
// ========================================

function validateImage(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(
      "Only JPEG, PNG, and WebP images are supported."
    )
  }

  if (file.size === 0) {
    throw new Error("The selected image is empty.")
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      "Profile pictures must be 5 MB or smaller."
    )
  }
}

// ========================================
// UPLOAD / REPLACE PROFILE PICTURE
// ========================================

export async function uploadProfilePicture(
  file: File
): Promise<string> {
  const user = requireUser()

  validateImage(file)

  // Automatically create the public profile
  // if this user doesn't have one yet.
  await ensurePublicProfile()

  const profileRef = doc(
    db,
    "publicProfiles",
    user.uid
  )

  const profileSnapshot = await getDoc(profileRef)

  if (!profileSnapshot.exists()) {
    throw new Error(
      "Could not initialize public profile."
    )
  }

  const previousPath: string | null =
    profileSnapshot.data().avatarPath ?? null

  // Step 1: Request a signed upload authorization.
  const { path, token } =
    await callAvatarFunction<UploadAuthorization>({
      action: "create-upload",
      contentType: file.type,
      size: file.size,
    })

  let uploaded = false

  try {
    // Step 2: Upload to private Supabase Storage.
    const { error } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(
        path,
        token,
        file,
        {
          contentType: file.type,
        }
      )

    if (error) {
      throw new Error(error.message)
    }

    uploaded = true

    // Step 3: Save the avatar path in Firestore.
    await updateDoc(profileRef, {
      avatarPath: path,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    // If Firestore fails after uploading,
    // attempt to remove the orphaned file.
    if (uploaded) {
      await callAvatarFunction<DeleteResponse>({
        action: "delete",
        path,
      }).catch((cleanupError) => {
        console.warn(
          "Avatar cleanup failed:",
          cleanupError
        )
      })
    }

    throw error
  }

  // Step 4: Remove the previous avatar.
  if (previousPath && previousPath !== path) {
    await callAvatarFunction<DeleteResponse>({
      action: "delete",
      path: previousPath,
    }).catch((cleanupError) => {
      console.warn(
        "Previous avatar cleanup failed:",
        cleanupError
      )
    })
  }

  return path
}

// ========================================
// GET CURRENT USER AVATAR
// ========================================

export async function getMyAvatarUrl():
  Promise<string | null> {
  const user = requireUser()

  // Ensure profile exists before reading.
  await ensurePublicProfile()

  const snapshot = await getDoc(
    doc(db, "publicProfiles", user.uid)
  )

  if (!snapshot.exists()) {
    return null
  }

  const path: string | null =
    snapshot.data().avatarPath ?? null

  if (!path) {
    return null
  }

  const response =
    await callAvatarFunction<AvatarUrlResponse>({
      action: "get-download",
      path,
    })

  return response.url
}

// ========================================
// GET ANOTHER USER'S AVATAR
// ========================================

export async function getUserAvatarUrl(
  userId: string
): Promise<string | null> {
  requireUser()

  if (!userId.trim()) {
    throw new Error("User ID is required.")
  }

  // Initialize the current user's profile.
  // The target user's profile is not created here.
  await ensurePublicProfile()

  const response =
    await callAvatarFunction<AvatarUrlResponse>({
      action: "get-public-avatar",
      userId,
    })

  return response.url
}

// ========================================
// REMOVE PROFILE PICTURE
// ========================================

export async function removeProfilePicture():
  Promise<void> {
  const user = requireUser()

  await ensurePublicProfile()

  const profileRef = doc(
    db,
    "publicProfiles",
    user.uid
  )

  const snapshot = await getDoc(profileRef)

  if (!snapshot.exists()) {
    return
  }

  const path: string | null =
    snapshot.data().avatarPath ?? null

  if (!path) {
    return
  }

  // Remove the Firestore reference.
  await updateDoc(profileRef, {
    avatarPath: null,
    updatedAt: serverTimestamp(),
  })

  // Remove the stored image.
  await callAvatarFunction<DeleteResponse>({
    action: "delete",
    path,
  }).catch((error) => {
    console.warn(
      "Avatar reference removed, but storage cleanup failed:",
      error
    )
  })
}
