
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore"

import { auth, db } from "../lib/firebase"

const TYPING_TTL_MS = 8000
const TYPING_THROTTLE_MS = 3000

export interface TypingStatus {
  userId: string
  isTyping: boolean
  updatedAt: Timestamp
  expiresAt: Timestamp
}

const lastTypingWrite = new Map<string, number>()

function typingCollection(conversationId: string) {
  return collection(
    db,
    "conversations",
    conversationId,
    "typing"
  )
}

function typingRef(
  conversationId: string,
  userId: string
) {
  return doc(
    typingCollection(conversationId),
    userId
  )
}

async function requireMember(
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

  if (
    !conversation.data().participants.includes(user.uid)
  ) {
    throw new Error("Not a conversation participant.")
  }

  return user.uid
}

// ======================================
// START TYPING
// ======================================

export async function startTyping(
  conversationId: string
): Promise<void> {
  const user = auth.currentUser

  if (!user) {
    throw new Error("You must be logged in.")
  }

  const key = `${conversationId}:${user.uid}`
  const now = Date.now()

  const lastWrite = lastTypingWrite.get(key) ?? 0

  if (now - lastWrite < TYPING_THROTTLE_MS) {
    return
  }

  const userId = await requireMember(conversationId)

  await setDoc(typingRef(conversationId, userId), {
    userId,
    isTyping: true,
    updatedAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(
      Date.now() + TYPING_TTL_MS
    ),
  })

  lastTypingWrite.set(key, Date.now())
}

// ======================================
// STOP TYPING
// ======================================

export async function stopTyping(
  conversationId: string
): Promise<void> {
  const userId = await requireMember(conversationId)

  await setDoc(typingRef(conversationId, userId), {
    userId,
    isTyping: false,
    updatedAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now()),
  })

  lastTypingWrite.delete(`${conversationId}:${userId}`)
}

// ======================================
// GET ACTIVE TYPING USERS
// ======================================

export function getActiveTypingUsers(
  statuses: TypingStatus[],
  currentUserId: string,
  now = Date.now()
): string[] {
  return statuses
    .filter(
      (status) =>
        status.userId !== currentUserId &&
        status.isTyping &&
        status.expiresAt instanceof Timestamp &&
        status.expiresAt.toMillis() > now
    )
    .map((status) => status.userId)
}

// ======================================
// REALTIME TYPING LISTENER
// ======================================

export function subscribeToTyping(
  conversationId: string,
  callback: (userIds: string[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const user = auth.currentUser

  if (!user) {
    throw new Error("You must be logged in.")
  }

  let statuses: TypingStatus[] = []

  const emit = () => {
    callback(
      getActiveTypingUsers(statuses, user.uid)
    )
  }

  const unsubscribe = onSnapshot(
    typingCollection(conversationId),
    (snapshot) => {
      statuses = snapshot.docs.map(
        (document) => document.data() as TypingStatus
      )

      emit()
    },
    (error) => {
      onError?.(error)
    }
  )

  // Firestore doesn't emit an event merely because
  // expiresAt passes. Recalculate locally every second.
  const interval = setInterval(emit, 1000)

  return () => {
    clearInterval(interval)
    unsubscribe()
  }
}
