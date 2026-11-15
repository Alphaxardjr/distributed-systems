
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore"

import { auth, db } from "../lib/firebase"

const MAX_MESSAGE_LENGTH = 5000

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

async function requireOwnedMessage(
  conversationId: string,
  messageId: string
) {
  const user = auth.currentUser

  if (!user) {
    throw new Error("You must be logged in.")
  }

  const reference = messageRef(conversationId, messageId)
  const snapshot = await getDoc(reference)

  if (!snapshot.exists()) {
    throw new Error("Message not found.")
  }

  const message = snapshot.data()

  if (message.senderId !== user.uid) {
    throw new Error("You can only modify your own messages.")
  }

  if (message.deletedAt != null) {
    throw new Error("This message has already been deleted.")
  }

  return { reference, message }
}

// ============================================
// EDIT TEXT MESSAGE
// ============================================

export async function editMessage(
  conversationId: string,
  messageId: string,
  newText: string
): Promise<void> {
  const text = newText.trim()

  if (!text) {
    throw new Error("Message cannot be empty.")
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new Error("Message is too long.")
  }

  const { reference, message } = await requireOwnedMessage(
    conversationId,
    messageId
  )

  if (message.type !== "text") {
    throw new Error("Only text messages can be edited.")
  }

  if (message.text === text) {
    return
  }

  await updateDoc(reference, {
    text,
    editedAt: serverTimestamp(),
  })
}

// ============================================
// SOFT DELETE MESSAGE
// ============================================

export async function deleteMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  const { reference, message } = await requireOwnedMessage(
    conversationId,
    messageId
  )

  if (
    !["text", "image", "gif"].includes(message.type)
  ) {
    throw new Error("Unsupported message type.")
  }

  await updateDoc(reference, {
    text: "",
    deletedAt: serverTimestamp(),
  })
}

// ============================================
// GET MESSAGE STATE
// ============================================

export async function getMessageState(
  conversationId: string,
  messageId: string
) {
  const snapshot = await getDoc(
    messageRef(conversationId, messageId)
  )

  if (!snapshot.exists()) {
    throw new Error("Message not found.")
  }

  const message = snapshot.data()

  return {
    id: snapshot.id,
    type: message.type as string,
    text: message.text as string,
    editedAt: message.editedAt ?? null,
    deletedAt: message.deletedAt ?? null,
    isEdited: message.editedAt != null,
    isDeleted: message.deletedAt != null,
  }
}
