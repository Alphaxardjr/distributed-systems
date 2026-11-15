
import {
  markConversationRead,
  getReadReceipts,
  subscribeToReadReceipts,
  getMessageReadStatus,
} from "../services/readReceiptService"

import { getDoc, doc } from "firebase/firestore"
import { auth, db } from "../lib/firebase"

const CONVERSATION_ID =
  "direct_RsmFjqg0vdYhBahb0nuH0PB1L8r2_fWDpzvz5b0Ul8Lh2zbi05xioav52"

const MESSAGE_ID = "UsvO88aT3WS20S0l5ZmK"

let unsubscribe: (() => void) | null = null

export function startReadReceiptListener() {
  unsubscribe?.()

  unsubscribe = subscribeToReadReceipts(
    CONVERSATION_ID,
    (receipts) => {
      console.log("Realtime read receipts:", receipts)
    },
    (error) => console.error("Listener error:", error)
  )
}

export async function testMarkRead() {
  try {
    await markConversationRead(
      CONVERSATION_ID,
      MESSAGE_ID
    )

    console.log("Read position updated successfully")
  } catch (error) {
    console.error("Mark read failed:", error)
  }
}

export async function testGetReadReceipts() {
  try {
    const receipts = await getReadReceipts(
      CONVERSATION_ID
    )

    console.log("Read receipts:", receipts)

    const message = await getDoc(
      doc(
        db,
        "conversations",
        CONVERSATION_ID,
        "messages",
        MESSAGE_ID
      )
    )

    const conversation = await getDoc(
      doc(db, "conversations", CONVERSATION_ID)
    )

    if (!message.exists() || !conversation.exists()) {
      throw new Error("Test documents not found.")
    }

    const status = getMessageReadStatus(
      message.data().createdAt,
      message.data().senderId,
      conversation.data().participants,
      receipts
    )

    console.log("Message read status:", status)
    console.log("Current user:", auth.currentUser?.uid)
  } catch (error) {
    console.error("Get read receipts failed:", error)
  }
}

export function stopReadReceiptListener() {
  unsubscribe?.()
  unsubscribe = null
}
