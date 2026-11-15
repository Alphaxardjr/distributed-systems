
import {
  sendAttachmentMessage,
  getMessages,
} from "../services/messageService"

const CONVERSATION_ID =
  "direct_RsmFjqg0vdYhBahb0nuH0PB1L8r2_fWDpzvz5b0Ul8Lh2zbi05xioav52"

export async function testAttachmentMessage(
  file: File
) {
  try {
    console.log("Sending attachment message...")

    const messageId = await sendAttachmentMessage(
      CONVERSATION_ID,
      file,
      "Testing Chatly image messaging"
    )

    console.log("Message created:", messageId)

    const messages = await getMessages(
      CONVERSATION_ID
    )

    const message = messages.find(
      (item) => item.id === messageId
    )

    console.log("Saved Firestore message:", message)

    if (!message) {
      console.warn(
        "Message not found in recent messages."
      )
    }
  } catch (error) {
    console.error(
      "Attachment message test failed:",
      error
    )
  }
}
