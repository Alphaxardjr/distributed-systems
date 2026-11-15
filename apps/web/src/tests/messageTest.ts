
import {
  sendMessage,
  getMessages,
  subscribeToMessages,
} from "../services/messageService"

export async function testMessaging(
  conversationId: string
) {
  console.log("Starting messaging test...")

  const unsubscribe = subscribeToMessages(
    conversationId,
    (messages) => {
      console.log("Real-time messages:", messages)
    },
    (error) => {
      console.error("Listener error:", error)
    }
  )

  try {
    const messageId = await sendMessage(
      conversationId,
      "Hello from Chatly! 😂"
    )

    console.log("Message sent:", messageId)

    const messages = await getMessages(conversationId)

    console.log("Message history:", messages)
  } catch (error) {
    console.error("Messaging test failed:", error)
  }

  // Return cleanup function for the listener
  return unsubscribe
}

