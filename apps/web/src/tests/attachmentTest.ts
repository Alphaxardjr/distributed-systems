
import {
  verifyAttachmentAccess,
  uploadChatImage,
  getAttachmentUrl,
  downloadAttachment,
  deleteAttachment,
  type ChatAttachment,
} from "../services/attachmentService"

const CONVERSATION_ID =
  "direct_RsmFjqg0vdYhBahb0nuH0PB1L8r2_fWDpzvz5b0Ul8Lh2zbi05xioav52"

// Store the last uploaded attachment for testing
let lastAttachment: ChatAttachment | null = null

// 1. Test authorization
export async function testAttachmentAuthorization() {
  try {
    console.log("Testing attachment authorization...")

    const authorized = await verifyAttachmentAccess(
      CONVERSATION_ID
    )

    console.log("Authorized:", authorized)
  } catch (error) {
    console.error("Authorization failed:", error)
  }
}

// 2. Test image upload
export async function testImageUpload(file: File) {
  try {
    console.log("Uploading:", file.name)

    const result = await uploadChatImage(
      CONVERSATION_ID,
      file
    )

    lastAttachment = result.attachment

    console.log("Upload successful:", result)
  } catch (error) {
    console.error("Upload failed:", error)
  }
}

// 3. Test private download URL
export async function testImageDownloadUrl() {
  if (!lastAttachment) {
    console.error("Upload an image first")
    return
  }

  try {
    const url = await getAttachmentUrl(
      CONVERSATION_ID,
      lastAttachment.storagePath
    )

    console.log("Signed download URL received:", url)
  } catch (error) {
    console.error("Download URL failed:", error)
  }
}

// 4. Test downloading image content
export async function testImageDownload() {
  if (!lastAttachment) {
    console.error("Upload an image first")
    return
  }

  try {
    const blob = await downloadAttachment(
      CONVERSATION_ID,
      lastAttachment
    )

    console.log("Download successful:", {
      size: blob.size,
      type: blob.type,
    })
  } catch (error) {
    console.error("Download failed:", error)
  }
}

// 5. Test deletion
export async function testImageDelete() {
  if (!lastAttachment) {
    console.error("Upload an image first")
    return
  }

  try {
    await deleteAttachment(
      CONVERSATION_ID,
      lastAttachment.storagePath
    )

    console.log("Attachment deleted successfully")

    lastAttachment = null
  } catch (error) {
    console.error("Delete failed:", error)
  }
}
