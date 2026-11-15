
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore"

import { auth, db } from "../lib/firebase"

export interface ReadReceipt {
  userId: string
  lastReadMessageId: string
  lastReadAt: Timestamp
  updatedAt: Timestamp
}

export interface MessageReadStatus {
  readBy: string[]
  readCount: number
  readByEveryone: boolean
}

function conversationRef(conversationId: string) {
  return doc(db, "conversations", conversationId)
}

function messageRef(
  conversationId: string,
  messageId: string
) {
  return doc(
    db,
    "conversations",
    conversationId,
    "messages",
    messageId
  )
}

function receiptsRef(conversationId: string) {
  return collection(
    db,
    "conversations",
    conversationId,
    "readReceipts"
  )
}

function receiptRef(
  conversationId: string,
  userId: string
) {
  return doc(receiptsRef(conversationId), userId)
}

async function requireMember(
  conversationId: string
): Promise<string> {
  const user = auth.currentUser

  if (!user) {
    throw new Error("You must be logged in.")
  }

  const snapshot = await getDoc(
    conversationRef(conversationId)
  )

  if (!snapshot.exists()) {
    throw new Error("Conversation not found.")
  }

  const participants = snapshot.data().participants

  if (
    !Array.isArray(participants) ||
    !participants.includes(user.uid)
  ) {
    throw new Error("Not a conversation participant.")
  }

  return user.uid
}

// ============================================
// MARK CONVERSATION READ
// ============================================

export async function markConversationRead(
  conversationId: string,
  messageId: string
): Promise<void> {
  const userId = await requireMember(conversationId)

  const targetMessage = await getDoc(
    messageRef(conversationId, messageId)
  )

  if (!targetMessage.exists()) {
    throw new Error("Message not found.")
  }

  const targetCreatedAt = targetMessage.data().createdAt

  if (!(targetCreatedAt instanceof Timestamp)) {
    throw new Error("Message timestamp unavailable.")
  }

  const reference = receiptRef(conversationId, userId)

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reference)

    if (existing.exists()) {
      const previous = existing.data().lastReadAt

      // Never move a user's read position backward.
      if (
        previous instanceof Timestamp &&
        previous.toMillis() >= targetCreatedAt.toMillis()
      ) {
        return
      }

      transaction.update(reference, {
        lastReadMessageId: messageId,
        lastReadAt: targetCreatedAt,
        updatedAt: serverTimestamp(),
      })
    } else {
      transaction.set(reference, {
        userId,
        lastReadMessageId: messageId,
        lastReadAt: targetCreatedAt,
        updatedAt: serverTimestamp(),
      })
    }
  })
}

// ============================================
// GET ALL READ RECEIPTS
// ============================================

export async function getReadReceipts(
  conversationId: string
): Promise<ReadReceipt[]> {
  await requireMember(conversationId)

  const snapshot = await getDocs(
    receiptsRef(conversationId)
  )

  return snapshot.docs.map(
    (document) => document.data() as ReadReceipt
  )
}

// ============================================
// REALTIME READ RECEIPTS
// ============================================

export function subscribeToReadReceipts(
  conversationId: string,
  callback: (receipts: ReadReceipt[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    receiptsRef(conversationId),
    (snapshot) => {
      callback(
        snapshot.docs.map(
          (document) => document.data() as ReadReceipt
        )
      )
    },
    (error) => {
      console.error("Read receipt listener error:", error)
      onError?.(error)
    }
  )
}

// ============================================
// CHECK WHETHER A MESSAGE WAS READ
// ============================================

export function getMessageReadStatus(
  messageCreatedAt: Timestamp,
  senderId: string,
  participants: string[],
  receipts: ReadReceipt[]
): MessageReadStatus {
  const recipients = participants.filter(
    (userId) => userId !== senderId
  )

  const readBy = receipts
    .filter(
      (receipt) =>
        recipients.includes(receipt.userId) &&
        receipt.lastReadAt instanceof Timestamp &&
        receipt.lastReadAt.toMillis() >=
          messageCreatedAt.toMillis()
    )
    .map((receipt) => receipt.userId)

  return {
    readBy,
    readCount: readBy.length,
    readByEveryone:
      recipients.length > 0 &&
      recipients.every((id) => readBy.includes(id)),
  }
}
