
import {
  editMessage,
  deleteMessage,
  getMessageState,
} from "../services/messageManagementService"

import { sendMessage } from "../services/messageService"

const CONVERSATION_ID =
  "direct_RsmFjqg0vdYhBahb0nuH0PB1L8r2_fWDpzvz5b0Ul8Lh2zbi05xioav52"

let testMessageId: string | null = null

export async function testCreateEditableMessage() {
  try {
    testMessageId = await sendMessage(
      CONVERSATION_ID,
      "Original Chatly test message"
    )

    console.log("Created message:", testMessageId)
  } catch (error) {
    console.error("Create failed:", error)
  }
}

export async function testEditMessage() {
  if (!testMessageId) {
    console.error("Create a test message first.")
    return
  }

  try {
    await editMessage(
      CONVERSATION_ID,
      testMessageId,
      "This message has been edited!"
    )

    console.log(
      "Edited message:",
      await getMessageState(CONVERSATION_ID, testMessageId)
    )
  } catch (error) {
    console.error("Edit failed:", error)
  }
}

export async function testDeleteMessage() {
  if (!testMessageId) {
    console.error("Create a test message first.")
    return
  }

  try {
    await deleteMessage(
      CONVERSATION_ID,
      testMessageId
    )

    console.log(
      "Deleted message:",
      await getMessageState(CONVERSATION_ID, testMessageId)
    )
  } catch (error) {
    console.error("Delete failed:", error)
  }
}

export async function testEditDeletedMessage() {
  if (!testMessageId) return

  try {
    await editMessage(
      CONVERSATION_ID,
      testMessageId,
      "This should fail"
    )

    console.error("Unexpected: edit succeeded")
  } catch (error) {
    console.log(
      "Correctly rejected editing a deleted message:",
      error
    )
  }
}
