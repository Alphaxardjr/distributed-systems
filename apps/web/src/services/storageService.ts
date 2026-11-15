
import {
  ref,
  uploadBytesResumable,
  type UploadTask,
} from "firebase/storage"
import { auth, storage } from "../lib/firebase"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]

export function uploadChatImage(
  conversationId: string,
  file: File
): UploadTask {
  const user = auth.currentUser

  if (!user) {
    throw new Error("You must be logged in.")
  }

  if (!conversationId.trim()) {
    throw new Error("Conversation ID is required.")
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Unsupported image format.")
  }

  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    throw new Error("Image must be between 1 byte and 10 MB.")
  }

  const fileId = crypto.randomUUID()

  const storagePath =
    `conversations/${conversationId}/attachments/${fileId}`

  const storageRef = ref(storage, storagePath)

  return uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      uploadedBy: user.uid,
      conversationId,
      originalName: file.name,
    },
  })
}
