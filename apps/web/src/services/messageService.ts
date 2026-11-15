
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore"

import { auth, db } from "../lib/firebase"
import {
  uploadAttachment,
  deleteAttachment,
} from "./attachmentService"
import type { ChatMessage } from "../types/chat"

// =====================================================
// CONFIGURATION
// =====================================================

const MAX_MESSAGE_LENGTH = 5000
const DEFAULT_PAGE_SIZE = 30

// =====================================================
// FIRESTORE REFERENCES
// =====================================================

function messagesRef(conversationId: string) {
  return collection(
    db,
    "conversations",
    conversationId,
    "messages"
  )
}

// =====================================================
// AUTHORIZATION
// =====================================================

async function requireConversationMember(
  conversationId: string
): Promise<string> {
  const user = auth.currentUser

  if (!user) {
    throw new Error("You must be logged in.")
  }

  const conversation = await getDoc(
    doc(db, "conversations", conversationId)
  )

  if (!conversation.exists()) {
    throw new Error("Conversation not found.")
  }

  const participants = conversation.data().participants

  if (
    !Array.isArray(participants) ||
    !participants.includes(user.uid)
  ) {
    throw new Error(
      "You are not a conversation participant."
    )
  }

  return user.uid
}

// =====================================================
// SEND TEXT MESSAGE
// =====================================================

export async function sendMessage(
  conversationId: string,
  text: string,
  replyTo: string | null = null
): Promise<string> {
  const senderId = await requireConversationMember(
    conversationId
  )

  const messageText = text.trim()

  if (!messageText) {
    throw new Error("Message cannot be empty.")
  }

  if (messageText.length > MAX_MESSAGE_LENGTH) {
    throw new Error("Message is too long.")
  }

  const message = await addDoc(
    messagesRef(conversationId),
    {
      senderId,
      type: "text",
      text: messageText,
      replyTo,
      createdAt: serverTimestamp(),
    }
  )

  return message.id
}

// =====================================================
// SEND ATTACHMENT MESSAGE
// =====================================================


export async function sendAttachmentMessage(
  conversationId: string,
  file: File,
  text = "",
  replyTo: string | null = null
): Promise<string> {
  console.log("1. Checking conversation membership")

  const senderId = await requireConversationMember(
    conversationId
  )

  console.log("2. Membership verified:", senderId)

  const messageText = text.trim()

  if (messageText.length > MAX_MESSAGE_LENGTH) {
    throw new Error("Message caption is too long.")
  }

  console.log("3. Uploading attachment to Supabase")

  const { attachment, type } = await uploadAttachment(
    conversationId,
    file
  )

  console.log("4. Attachment uploaded:", attachment.storagePath)

  try {
    console.log("5. Creating Firestore message")

    const message = await addDoc(
      messagesRef(conversationId),
      {
        senderId,
        type,
        text: messageText,
        attachment,
        replyTo,
        createdAt: serverTimestamp(),
      }
    )

    console.log("6. Firestore message created:", message.id)

    return message.id
  } catch (error) {
    console.error("Firestore message creation failed:", error)

    try {
      await deleteAttachment(
        conversationId,
        attachment.storagePath
      )

      console.log("Uploaded attachment cleaned up")
    } catch (cleanupError) {
      console.error("Attachment cleanup failed:", cleanupError)
    }

    throw error
  }
}


// =====================================================
// GET RECENT MESSAGES
// =====================================================

export async function getMessages(
  conversationId: string,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<ChatMessage[]> {
  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw new Error("Page size must be between 1 and 100.")
  }

  const messagesQuery = query(
    messagesRef(conversationId),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  )

  const snapshot = await getDocs(messagesQuery)

  return snapshot.docs
    .map((document) => ({
      id: document.id,
      ...document.data(),
    } as ChatMessage))
    .reverse()
}

// =====================================================
// SUBSCRIBE TO REAL-TIME MESSAGES
// =====================================================

export function subscribeToMessages(
  conversationId: string,
  callback: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const messagesQuery = query(
    messagesRef(conversationId),
    orderBy("createdAt", "desc"),
    limit(DEFAULT_PAGE_SIZE)
  )

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const messages = snapshot.docs
        .map((document) => ({
          id: document.id,
          ...document.data(),
        } as ChatMessage))
        .reverse()

      callback(messages)
    },
    (error) => {
      console.error(
        "Message subscription error:",
        error
      )

      onError?.(error)
    }
  )
}
