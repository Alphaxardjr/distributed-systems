
import {
  startTyping,
  stopTyping,
  subscribeToTyping,
} from "../services/typingService"

const CONVERSATION_ID =
  "direct_RsmFjqg0vdYhBahb0nuH0PB1L8r2_fWDpzvz5b0Ul8Lh2zbi05xioav52"

let unsubscribe: (() => void) | null = null

export function testTypingListener() {
  unsubscribe?.()

  unsubscribe = subscribeToTyping(
    CONVERSATION_ID,
    (userIds) => {
      console.log("Users currently typing:", userIds)
    },
    (error) => {
      console.error("Typing listener failed:", error)
    }
  )
}

export async function testStartTyping() {
  try {
    await startTyping(CONVERSATION_ID)
    console.log("Typing started")
  } catch (error) {
    console.error("Start typing failed:", error)
  }
}

export async function testStopTyping() {
  try {
    await stopTyping(CONVERSATION_ID)
    console.log("Typing stopped")
  } catch (error) {
    console.error("Stop typing failed:", error)
  }
}

export function stopTypingListener() {
  unsubscribe?.()
  unsubscribe = null
}
