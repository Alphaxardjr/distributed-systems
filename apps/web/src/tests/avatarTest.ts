
import {
  uploadProfilePicture,
  getMyAvatarUrl,
  getUserAvatarUrl,
  removeProfilePicture,
} from "../services/avatarService"

import { auth } from "../lib/firebase"

// Upload an avatar.
export async function testAvatarUpload(
  file: File
) {
  try {
    const path = await uploadProfilePicture(file)

    console.log("Avatar uploaded:", path)

    const url = await getMyAvatarUrl()

    console.log("Avatar URL:", url)
  } catch (error) {
    console.error("Avatar upload failed:", error)
  }
}

// Get current user's avatar.
export async function testGetMyAvatar() {
  try {
    const url = await getMyAvatarUrl()

    console.log("My avatar:", url)
  } catch (error) {
    console.error("Get avatar failed:", error)
  }
}

// Test public avatar retrieval.
export async function testGetPublicAvatar() {
  try {
    const uid = auth.currentUser?.uid

    if (!uid) {
      throw new Error("Not authenticated")
    }

    const url = await getUserAvatarUrl(uid)

    console.log("Public avatar:", url)
  } catch (error) {
    console.error("Public avatar failed:", error)
  }
}

// Remove the avatar.
export async function testRemoveAvatar() {
  try {
    await removeProfilePicture()

    console.log("Avatar removed successfully")
  } catch (error) {
    console.error("Remove avatar failed:", error)
  }
}
