
import { subscribeToMessages } from "../services/messageService"

export function testRealtimeMessaging(conversationId: string) {
  console.log("Listening for messages:", conversationId)

  const unsubscribe = subscribeToMessages(
    conversationId,
    (messages) => {
      console.log("Real-time update:", messages)
    },
    (error) => {
      console.error("Real-time listener failed:", error)
    }
  )

  return unsubscribe
}
