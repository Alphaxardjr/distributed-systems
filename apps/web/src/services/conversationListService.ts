import type { ChatMessage, Conversation } from "../types/chat"

import {
  collection,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore"

import { auth, db } from "../lib/firebase"

import { calculateUnreadCount, type UnreadMessage } from "./unreadService"

export interface LastMessage {
  id: string
  senderId: string
  type: ChatMessage["type"]
  text: string
  createdAt: Timestamp
  isEdited: boolean
  isDeleted: boolean
}

export interface ConversationListItem {
  id: string
  type: "direct" | "group"
  name: string | null
  photoURL: string | null
  participants: string[]
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
  lastMessage: LastMessage | null
  unreadCount: number
}

interface ConversationState {
  item: ConversationListItem
  messages: UnreadMessage[]
  lastReadAt: Timestamp | null
  messagesReady: boolean
  receiptReady: boolean
  unsubscribeMessages: Unsubscribe
  unsubscribeReceipt: Unsubscribe
}

function requireAuth(): string {
  const user = auth.currentUser

  if (!user) {
    throw new Error("You must be logged in.")
  }

  return user.uid
}

function conversationQuery(userId: string) {
  return query(
    collection(db, "conversations"),
    where("participants", "array-contains", userId)
  )
}

function messagesCollection(conversationId: string) {
  return collection(db, "conversations", conversationId, "messages")
}

function receiptDocument(conversationId: string, userId: string) {
  return doc(db, "conversations", conversationId, "readReceipts", userId)
}

function timestampMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : 0
}

function sortItems(items: ConversationListItem[]): ConversationListItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ?? a.updatedAt

    const bTime = b.lastMessage?.createdAt ?? b.updatedAt

    return timestampMillis(bTime) - timestampMillis(aTime)
  })
}

// ======================================
// ONE-TIME CONVERSATION LIST
// ======================================

export async function getUserConversations(): Promise<ConversationListItem[]> {
  const userId = requireAuth()

  const conversations = await getDocs(conversationQuery(userId))

  const results = await Promise.all(
    conversations.docs.map(async (conversation) => {
      const data = conversation.data()

      const [messagesSnapshot, receiptSnapshot] = await Promise.all([
        getDocs(messagesCollection(conversation.id)),
        getDoc(receiptDocument(conversation.id, userId)),
      ])

      const messages = messagesSnapshot.docs.map(
        (message) =>
          ({
            id: message.id,
            ...message.data(),
          }) as ChatMessage
      )

      const ordered = [...messages].sort(
        (a, b) =>
          timestampMillis(b.createdAt) - timestampMillis(a.createdAt) ||
          b.id.localeCompare(a.id)
      )

      const latest = ordered[0] ?? null

      const lastReadAt = receiptSnapshot.exists()
        ? receiptSnapshot.data().lastReadAt
        : null

      return {
        id: conversation.id,
        type: data.type,
        name: data.name,
        photoURL: data.photoURL,
        participants: data.participants,
        createdBy: data.createdBy,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        lastMessage: latest
          ? {
              id: latest.id,
              senderId: latest.senderId,
              type: latest.type,
              text: latest.text ?? "",
              createdAt: latest.createdAt,
              isEdited: latest.editedAt != null,
              isDeleted: latest.deletedAt != null,
            }
          : null,
        unreadCount: calculateUnreadCount(
          messages as UnreadMessage[],
          userId,
          lastReadAt instanceof Timestamp ? lastReadAt : null
        ),
      } as ConversationListItem
    })
  )

  return sortItems(results)
}

// ======================================
// REALTIME CONVERSATION LIST
// ======================================

export function subscribeToConversations(
  callback: (items: ConversationListItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const userId = requireAuth()

  const states = new Map<string, ConversationState>()

  let active = true
  let conversationsReady = false

  function emit() {
    if (!active || !conversationsReady) return

    // Wait until all active conversations have
    // their initial messages and receipts.
    for (const state of states.values()) {
      if (!state.messagesReady || !state.receiptReady) {
        return
      }
    }

    const items = [...states.values()].map((state) => state.item)

    callback(sortItems(items))
  }

  function recalculate(state: ConversationState) {
    state.item.unreadCount = calculateUnreadCount(
      state.messages,
      userId,
      state.lastReadAt
    )

    emit()
  }

  function removeConversation(id: string) {
    const state = states.get(id)

    if (!state) return

    states.delete(id)

    state.unsubscribeMessages()
    state.unsubscribeReceipt()
  }

  function addConversation(id: string, data: Omit<Conversation, "id">) {
    const item: ConversationListItem = {
      id,
      type: data.type,
      name: data.name,
      photoURL: data.photoURL,
      participants: data.participants,
      createdBy: data.createdBy,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastMessage: null,
      unreadCount: 0,
    }

    const state: ConversationState = {
      item,
      messages: [],
      lastReadAt: null,
      messagesReady: false,
      receiptReady: false,
      unsubscribeMessages: () => {},
      unsubscribeReceipt: () => {},
    }

    states.set(id, state)

    // Listen to all message changes.
    state.unsubscribeMessages = onSnapshot(
      messagesCollection(id),
      (snapshot) => {
        if (!active || states.get(id) !== state) {
          return
        }

        const messages = snapshot.docs.map(
          (document) =>
            ({
              id: document.id,
              ...document.data(),
            }) as ChatMessage
        )

        state.messages = messages as UnreadMessage[]

        const ordered = [...messages].sort(
          (a, b) =>
            timestampMillis(b.createdAt) - timestampMillis(a.createdAt) ||
            b.id.localeCompare(a.id)
        )

        const latest = ordered[0] ?? null

        state.item.lastMessage = latest
          ? {
              id: latest.id,
              senderId: latest.senderId,
              type: latest.type,
              text: latest.text ?? "",
              createdAt: latest.createdAt,
              isEdited: latest.editedAt != null,
              isDeleted: latest.deletedAt != null,
            }
          : null

        state.messagesReady = true
        recalculate(state)
      },
      (error) => {
        if (active && states.get(id) === state) {
          onError?.(error)
        }
      }
    )

    // Listen to this user's read position.
    state.unsubscribeReceipt = onSnapshot(
      receiptDocument(id, userId),
      (snapshot) => {
        if (!active || states.get(id) !== state) {
          return
        }

        const value = snapshot.exists() ? snapshot.data().lastReadAt : null

        state.lastReadAt = value instanceof Timestamp ? value : null

        state.receiptReady = true
        recalculate(state)
      },
      (error) => {
        if (active && states.get(id) === state) {
          onError?.(error)
        }
      }
    )
  }

  const unsubscribeConversations = onSnapshot(
    conversationQuery(userId),
    (snapshot) => {
      if (!active) return

      const currentIds = new Set(snapshot.docs.map((document) => document.id))

      for (const id of [...states.keys()]) {
        if (!currentIds.has(id)) {
          removeConversation(id)
        }
      }

      for (const document of snapshot.docs) {
        const existing = states.get(document.id)
        const data = document.data()

        if (existing) {
          existing.item = {
            ...existing.item,
            type: data.type,
            name: data.name,
            photoURL: data.photoURL,
            participants: data.participants,
            createdBy: data.createdBy,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          }
        } else {
          addConversation(document.id, data as Omit<Conversation, "id">)
        }
      }

      conversationsReady = true
      emit()
    },
    (error) => {
      if (active) onError?.(error)
    }
  )

  return () => {
    active = false
    unsubscribeConversations()

    for (const id of [...states.keys()]) {
      removeConversation(id)
    }
  }
}
