
import { Timestamp } from "firebase/firestore"

export interface UnreadMessage {
  id: string
  senderId: string
  createdAt: Timestamp | null
  deletedAt?: Timestamp | null
}

export function calculateUnreadCount(
  messages: UnreadMessage[],
  currentUserId: string,
  lastReadAt: Timestamp | null
): number {
  return messages.filter((message) => {
    // Never count your own messages.
    if (message.senderId === currentUserId) {
      return false
    }

    // Never count deleted messages.
    if (message.deletedAt != null) {
      return false
    }

    if (!(message.createdAt instanceof Timestamp)) {
      return false
    }

    // No receipt means no messages acknowledged yet.
    if (!lastReadAt) {
      return true
    }

    return (
      message.createdAt.toMillis() >
      lastReadAt.toMillis()
    )
  }).length
}
