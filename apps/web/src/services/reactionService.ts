
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  onSnapshot,
  serverTimestamp,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore"

import { auth, db } from "../lib/firebase"

// ============================================
// TYPES
// ============================================

export interface MessageReaction {
  userId: string
  emoji: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ReactionSummary {
  emoji: string
  count: number
  userIds: string[]
  reactedByMe: boolean
}

// ============================================
// FIRESTORE REFERENCES
// ============================================

function reactionsRef(
  conversationId: string,
  messageId: string
) {
  return collection(
    db,
    "conversations",
    conversationId,
    "messages",
    messageId,
    "reactions"
  )
}

function reactionRef(
  conversationId: string,
  messageId: string,
  userId: string
) {
  return doc(
    reactionsRef(conversationId, messageId),
    userId
  )
}

// ============================================
// AUTHORIZATION
// ============================================

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

async function requireMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  const message = await getDoc(
    doc(
      db,
      "conversations",
      conversationId,
      "messages",
      messageId
    )
  )

  if (!message.exists()) {
    throw new Error("Message not found.")
  }
}

// ============================================
// EMOJI VALIDATION
// ============================================

export const ALLOWED_REACTIONS = [
  "❤️",
  "😂",
  "👍",
  "👎",
  "🔥",
  "😍",
  "😮",
  "😢",
  "🎉",
  "👏",
] as const

export function validateReaction(emoji: string): void {
  if (
    !ALLOWED_REACTIONS.includes(
      emoji as typeof ALLOWED_REACTIONS[number]
    )
  ) {
    throw new Error("Unsupported reaction emoji.")
  }
}

// ============================================
// ADD OR CHANGE REACTION
// ============================================

export async function addReaction(
  conversationId: string,
  messageId: string,
  emoji: string
): Promise<void> {
  validateReaction(emoji)

  const userId = await requireMember(conversationId)
  await requireMessage(conversationId, messageId)

  const reference = reactionRef(
    conversationId,
    messageId,
    userId
  )

  const existing = await getDoc(reference)

  if (existing.exists()) {
    await setDoc(
      reference,
      {
        userId,
        emoji,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
  } else {
    await setDoc(reference, {
      userId,
      emoji,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
}

// ============================================
// REMOVE REACTION
// ============================================

export async function removeReaction(
  conversationId: string,
  messageId: string
): Promise<void> {
  const userId = await requireMember(conversationId)

  await deleteDoc(
    reactionRef(conversationId, messageId, userId)
  )
}

// ============================================
// GET REACTIONS
// ============================================

export async function getReactions(
  conversationId: string,
  messageId: string
): Promise<MessageReaction[]> {
  await requireMember(conversationId)
  await requireMessage(conversationId, messageId)

  const snapshot = await getDocs(
    query(reactionsRef(conversationId, messageId))
  )

  return snapshot.docs.map(
    (document) => document.data() as MessageReaction
  )
}

// ============================================
// REALTIME REACTION SUBSCRIPTION
// ============================================

export function subscribeToReactions(
  conversationId: string,
  messageId: string,
  callback: (reactions: MessageReaction[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    reactionsRef(conversationId, messageId),
    (snapshot) => {
      const reactions = snapshot.docs.map(
        (document) => document.data() as MessageReaction
      )

      callback(reactions)
    },
    (error) => {
      console.error(
        "Reaction subscription error:",
        error
      )

      onError?.(error)
    }
  )
}

// ============================================
// REACTION SUMMARY
// ============================================

export function getReactionSummary(
  reactions: MessageReaction[]
): ReactionSummary[] {
  const currentUserId = auth.currentUser?.uid

  const grouped = new Map<
    string,
    { count: number; userIds: string[] }
  >()

  for (const reaction of reactions) {
    const existing = grouped.get(reaction.emoji)

    if (existing) {
      existing.count++
      existing.userIds.push(reaction.userId)
    } else {
      grouped.set(reaction.emoji, {
        count: 1,
        userIds: [reaction.userId],
      })
    }
  }

  return Array.from(grouped.entries()).map(
    ([emoji, data]) => ({
      emoji,
      count: data.count,
      userIds: data.userIds,
      reactedByMe: data.userIds.includes(
        currentUserId ?? ""
      ),
    })
  )
}
