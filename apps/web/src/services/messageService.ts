
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

import { auth, db } from "../../firebase/config"
import type { ChatMessage } from "../types/chat"

// Reference to a conversation's messages
function messagesRef(conversationId: string) {
  return collection(
    db,
    "conversations",
    conversationId,
    "messages"
  )
}

// SEND A TEXT MESSAGE
export async function sendMessage(
  conversationId: string,
  text: string,
  replyTo: string | null = null
): Promise<string> {
  const user = auth.currentUser

  if (!user) {
    throw new Error("You must be logged in.")
  }

  const messageText = text.trim()

  if (!messageText) {
    throw new Error("Message cannot be empty.")
  }

  if (messageText.length > 5000) {
    throw new Error("Message is too long.")
  }

  const conversation = await getDoc(
    doc(db, "conversations", conversationId)
  )

  if (!conversation.exists()) {
    throw new Error("Conversation not found.")
  }

  if (!conversation.data().participants.includes(user.uid)) {
    throw new Error("You are not a conversation participant.")
  }

  const message = await addDoc(messagesRef(conversationId), {
    senderId: user.uid,
    type: "text",
    text: messageText,
    replyTo,
    createdAt: serverTimestamp(),
  })

  return message.id
}

// GET RECENT MESSAGES
export async function getMessages(
  conversationId: string,
  pageSize = 30
): Promise<ChatMessage[]> {
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

// SUBSCRIBE TO REAL-TIME MESSAGES
export function subscribeToMessages(
  conversationId: string,
  callback: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const messagesQuery = query(
    messagesRef(conversationId),
    orderBy("createdAt", "desc"),
    limit(30)
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
      console.error("Message subscription error:", error)
      onError?.(error)
    }
  )
}
