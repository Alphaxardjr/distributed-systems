
import {
  doc,
  getDoc,
  runTransaction,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore"

import { auth, db } from "../lib/firebase"

// Create or retrieve a private conversation
export async function createDirectConversation(
  otherUserId: string
): Promise<string> {
  const currentUser = auth.currentUser

  if (!currentUser) {
    throw new Error("You must be logged in.")
  }

  if (currentUser.uid === otherUserId) {
    throw new Error("You cannot chat with yourself.")
  }

  const participants = [currentUser.uid, otherUserId].sort()

  // Verify the recipient has a Chatly profile
  const recipient = await getDoc(doc(db, "users", otherUserId))

  if (!recipient.exists()) {
    throw new Error("Recipient not found.")
  }

  const conversationId = `direct_${participants.join("_")}`
  const conversationRef = doc(db, "conversations", conversationId)

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(conversationRef)

    if (!snapshot.exists()) {
      transaction.set(conversationRef, {
        type: "direct",
        name: null,
        photoURL: null,
        participants,
        admins: [],
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
  })

  return conversationId
}

// Create a new group conversation
export async function createGroupConversation(
  name: string,
  memberIds: string[]
): Promise<string> {
  const currentUser = auth.currentUser

  if (!currentUser) {
    throw new Error("You must be logged in.")
  }

  const groupName = name.trim()

  if (!groupName) {
    throw new Error("Group name is required.")
  }

  const participants = [
    ...new Set([currentUser.uid, ...memberIds]),
  ]

  if (participants.length < 2) {
    throw new Error("A group needs at least two members.")
  }

  const conversationRef = await addDoc(
    collection(db, "conversations"),
    {
      type: "group",
      name: groupName,
      photoURL: null,
      participants,
      admins: [currentUser.uid],
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  )

  return conversationRef.id
}
