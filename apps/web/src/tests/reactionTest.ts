
import {
  addReaction,
  removeReaction,
  getReactions,
  getReactionSummary,
  subscribeToReactions,
} from "../services/reactionService"

const CONVERSATION_ID =
  "direct_RsmFjqg0vdYhBahb0nuH0PB1L8r2_fWDpzvz5b0Ul8Lh2zbi05xioav52"

// Your successfully created image message
const MESSAGE_ID = "UsvO88aT3WS20S0l5ZmK"

let unsubscribe: (() => void) | null = null

export async function testAddReaction() {
  try {
    await addReaction(
      CONVERSATION_ID,
      MESSAGE_ID,
      "❤️"
    )

    console.log("Reaction added successfully")
  } catch (error) {
    console.error("Add reaction failed:", error)
  }
}

export async function testChangeReaction() {
  try {
    await addReaction(
      CONVERSATION_ID,
      MESSAGE_ID,
      "😂"
    )

    console.log("Reaction changed successfully")
  } catch (error) {
    console.error("Change reaction failed:", error)
  }
}

export async function testGetReactions() {
  try {
    const reactions = await getReactions(
      CONVERSATION_ID,
      MESSAGE_ID
    )

    console.log("Reactions:", reactions)
    console.log(
      "Summary:",
      getReactionSummary(reactions)
    )
  } catch (error) {
    console.error("Get reactions failed:", error)
  }
}

export function testSubscribeReactions() {
  unsubscribe?.()

  unsubscribe = subscribeToReactions(
    CONVERSATION_ID,
    MESSAGE_ID,
    (reactions) => {
      console.log("Realtime reactions:", reactions)
    },
    (error) => {
      console.error("Subscription failed:", error)
    }
  )
}

export async function testRemoveReaction() {
  try {
    await removeReaction(
      CONVERSATION_ID,
      MESSAGE_ID
    )

    console.log("Reaction removed successfully")
  } catch (error) {
    console.error("Remove reaction failed:", error)
  }
}

export function stopReactionSubscription() {
  unsubscribe?.()
  unsubscribe = null

  console.log("Reaction subscription stopped")
}
