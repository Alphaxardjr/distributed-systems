
import { auth } from "../lib/firebase"
import { createClient } from "@supabase/supabase-js"

// =====================================================
// CONFIGURATION
// =====================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const EDGE_FUNCTION = "chat-attachments"
const STORAGE_BUCKET = "chat-attachments"

const MAX_FILE_SIZE = 10 * 1024 * 1024

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase environment variables")
}

// Dedicated client for signed Storage operations.
// Firebase authentication is handled by the Edge Function.
const storageClient = createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

// =====================================================
// TYPES
// =====================================================

export type AttachmentType =
  | "image"
  | "gif"
  | "video"
  | "file"

export interface ChatAttachment {
  name: string
  storagePath: string
  contentType: string
  size: number
}

export interface UploadAuthorization {
  path: string
  token: string
  signedUrl: string
}

export interface DownloadAuthorization {
  signedUrl: string
  expiresIn: number
}

export interface AttachmentUploadResult {
  attachment: ChatAttachment
  type: AttachmentType
}

export type UploadProgressCallback = (
  progress: number
) => void

// =====================================================
// FILE VALIDATION
// =====================================================

export function validateAttachment(file: File): void {
  if (!file) {
    throw new Error("No file selected")
  }

  if (file.size === 0) {
    throw new Error("Cannot upload an empty file")
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File exceeds the 10 MB limit")
  }

  if (
    !ALLOWED_MIME_TYPES.includes(
      file.type as typeof ALLOWED_MIME_TYPES[number]
    )
  ) {
    throw new Error(
      `Unsupported file type: ${file.type || "unknown"}`
    )
  }
}

// =====================================================
// ATTACHMENT TYPE DETECTION
// =====================================================

export function getAttachmentType(
  contentType: string
): AttachmentType {
  if (contentType === "image/gif") {
    return "gif"
  }

  if (contentType.startsWith("image/")) {
    return "image"
  }

  if (contentType.startsWith("video/")) {
    return "video"
  }

  return "file"
}

// =====================================================
// FORMAT FILE SIZE
// =====================================================

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// =====================================================
// EDGE FUNCTION COMMUNICATION
// =====================================================

export async function callAttachmentFunction<T>(
  action: string,
  conversationId: string,
  extra: Record<string, unknown> = {}
): Promise<T> {
  const user = auth.currentUser

  if (!user) {
    throw new Error("User is not authenticated")
  }

  const firebaseToken = await user.getIdToken()

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/${EDGE_FUNCTION}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firebaseToken}`,
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...extra,
        action,
        conversationId,
      }),
    }
  )

  let result: unknown

  try {
    result = await response.json()
  } catch {
    throw new Error(
      `Invalid Edge Function response (${response.status})`
    )
  }

  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : `Request failed (${response.status})`

    throw new Error(message)
  }

  return result as T
}

// =====================================================
// CHECK AUTHORIZATION
// =====================================================

export async function verifyAttachmentAccess(
  conversationId: string
): Promise<boolean> {
  const result = await callAttachmentFunction<{
    authenticated: boolean
    authorized: boolean
  }>("test-authorization", conversationId)

  return result.authenticated && result.authorized
}

// =====================================================
// REQUEST SIGNED UPLOAD
// =====================================================

export async function requestUploadAuthorization(
  conversationId: string,
  file: File
): Promise<UploadAuthorization> {
  validateAttachment(file)

  return callAttachmentFunction<UploadAuthorization>(
    "create-upload",
    conversationId,
    {
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }
  )
}

// =====================================================
// UPLOAD ATTACHMENT
// =====================================================

export async function uploadAttachment(
  conversationId: string,
  file: File
): Promise<AttachmentUploadResult> {
  validateAttachment(file)

  const authorization =
    await requestUploadAuthorization(
      conversationId,
      file
    )

  const { error } = await storageClient.storage
    .from(STORAGE_BUCKET)
    .uploadToSignedUrl(
      authorization.path,
      authorization.token,
      file,
      {
        contentType: file.type,
        upsert: false,
      }
    )

  if (error) {
    throw new Error(
      `Attachment upload failed: ${error.message}`
    )
  }

  const attachment: ChatAttachment = {
    name: file.name,
    storagePath: authorization.path,
    contentType: file.type,
    size: file.size,
  }

  return {
    attachment,
    type: getAttachmentType(file.type),
  }
}

// =====================================================
// UPLOAD IMAGE
// =====================================================

export async function uploadChatImage(
  conversationId: string,
  file: File
): Promise<AttachmentUploadResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selected file is not an image")
  }

  return uploadAttachment(conversationId, file)
}

// =====================================================
// REQUEST PRIVATE DOWNLOAD URL
// =====================================================

export async function getAttachmentUrl(
  conversationId: string,
  storagePath: string
): Promise<string> {
  const result =
    await callAttachmentFunction<DownloadAuthorization>(
      "get-download",
      conversationId,
      {
        path: storagePath,
      }
    )

  return result.signedUrl
}

// =====================================================
// DOWNLOAD ATTACHMENT AS BLOB
// =====================================================

export async function downloadAttachment(
  conversationId: string,
  attachment: ChatAttachment
): Promise<Blob> {
  const url = await getAttachmentUrl(
    conversationId,
    attachment.storagePath
  )

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Download failed (${response.status})`
    )
  }

  return response.blob()
}

// =====================================================
// DELETE ATTACHMENT
// =====================================================

export async function deleteAttachment(
  conversationId: string,
  storagePath: string
): Promise<void> {
  await callAttachmentFunction<{ deleted: boolean }>(
    "delete",
    conversationId,
    {
      path: storagePath,
    }
  )
}

// =====================================================
// CREATE LOCAL PREVIEW
// =====================================================

export function createAttachmentPreview(
  file: File
): string {
  return URL.createObjectURL(file)
}

// Always release the preview when no longer needed.
export function revokeAttachmentPreview(
  previewUrl: string
): void {
  URL.revokeObjectURL(previewUrl)
}
