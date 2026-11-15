import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ArrowLeft, Paperclip, Send, X, Smile, Users } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { ChatMessage } from "../../types/chat"
import type { ConversationListItem } from "../../services/conversationListService"
import type { PublicProfile } from "../../services/publicProfileService"
import {
  subscribeToMessages,
  sendMessage,
  sendAttachmentMessage,
} from "../../services/messageService"
import {
  subscribeToReadReceipts,
  markConversationRead,
  getMessageReadStatus,
  type ReadReceipt,
} from "../../services/readReceiptService"
import {
  startTyping,
  stopTyping,
  subscribeToTyping,
} from "../../services/typingService"
import { validateAttachment } from "../../services/attachmentService"
import { MessageItem } from "./MessageItem"
import { ErrorNotice, errorText } from "./feedback"
import { Avatar } from "./Avatar"

export interface Draft {
  text: string
  file?: File
}
export function ConversationView({
  conversation,
  uid,
  profiles,
  draft,
  onDraft,
  onBack,
  busy,
  onBusy,
  onSendError,
}: {
  conversation: ConversationListItem
  uid: string
  profiles: Record<string, PublicProfile>
  draft: Draft
  onDraft: (draft: Draft) => void
  onBack: () => void
  busy: boolean
  onBusy: (value: boolean) => void
  onSendError: (message: string) => void
}) {
  const composer = useRef<HTMLTextAreaElement>(null)
  const upload = useRef<HTMLInputElement>(null)
  const sendLock = useRef(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  useEffect(() => {
    const element = composer.current
    if (element) {
      element.style.height = "auto"
      element.style.height = `${Math.min(element.scrollHeight, 160)}px`
    }
  }, [draft.text])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [receipts, setReceipts] = useState<ReadReceipt[]>([])
  const [typing, setTyping] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const [nearBottom, setNearBottom] = useState(true)
  const [newMessages, setNewMessages] = useState(0)
  const previousMessages = useRef<ChatMessage[]>([])
  const initialScroll = useRef(true)
  const scrollAnchor = useRef<{ id: string; top: number } | null>(null)
  const content = useRef<HTMLDivElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const follow = useRef(true)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const typingActive = useRef(false)
  const typingQueue = useRef(Promise.resolve())
  const latestRead = useRef("")
  const id = conversation.id
  const nameFor = (userId: string) =>
    profiles[userId]?.displayName || "Loading profile…"
  const other =
    conversation.participants.find((participant) => participant !== uid) || uid
  const title =
    conversation.type === "group"
      ? conversation.name || "Unnamed group"
      : nameFor(other)
  useEffect(() => {
    const fail = (reason: unknown) => {
      setError(errorText(reason))
      setLoading(false)
    }
    const stops = [
      subscribeToMessages(
        id,
        (data) => {
          const container = scroll.current
          if (container && !follow.current) {
            const visible = Array.from(
              container.querySelectorAll<HTMLElement>("[data-message-id]")
            ).find(
              (element) =>
                element.getBoundingClientRect().bottom >
                container.getBoundingClientRect().top
            )
            scrollAnchor.current = visible
              ? {
                  id: visible.dataset.messageId!,
                  top: visible.getBoundingClientRect().top,
                }
              : null
            const previous = previousMessages.current
            const lastIndex = data.findIndex(
              (item) => item.id === previous.at(-1)?.id
            )
            const previousIds = new Set(previous.map((item) => item.id))
            const added = data.filter(
              (item, index) =>
                !previousIds.has(item.id) &&
                item.senderId !== uid &&
                (lastIndex >= 0
                  ? index > lastIndex
                  : !!item.createdAt &&
                    !!previous.at(-1)?.createdAt &&
                    item.createdAt.toMillis() >
                      previous.at(-1)!.createdAt.toMillis())
            ).length
            if (added) setNewMessages((count) => count + added)
          }
          previousMessages.current = data
          setMessages(data)
          setLoading(false)
        },
        fail
      ),
      subscribeToReadReceipts(id, setReceipts, fail),
      subscribeToTyping(id, setTyping, fail),
    ]
    return () => {
      stops.forEach((stop) => stop())
      clearTimeout(typingTimer.current)
      if (typingActive.current) {
        typingQueue.current = typingQueue.current
          .then(() => stopTyping(id))
          .catch((reason) => {
            if (import.meta.env.DEV)
              console.error("Typing cleanup failed", reason)
          })
      }
    }
  }, [id, retry, uid])
  useLayoutEffect(() => {
    const container = scroll.current
    if (!container || loading) return
    if (initialScroll.current || follow.current) {
      container.scrollTop = container.scrollHeight
      initialScroll.current = false
    } else if (scrollAnchor.current) {
      const anchor = scrollAnchor.current
      const element = Array.from(
        container.querySelectorAll<HTMLElement>("[data-message-id]")
      ).find((item) => item.dataset.messageId === anchor.id)
      if (element)
        container.scrollTop += element.getBoundingClientRect().top - anchor.top
    }
    scrollAnchor.current = null
  }, [messages, loading])
  useEffect(() => {
    const element = content.current
    const container = scroll.current
    if (!element || !container) return
    const observer = new ResizeObserver(() => {
      if (follow.current) container.scrollTop = container.scrollHeight
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const newest = messages.at(-1)
    const mark = () => {
      if (
        !nearBottom ||
        document.visibilityState !== "visible" ||
        !document.hasFocus() ||
        !newest?.createdAt ||
        latestRead.current === newest.id
      )
        return
      latestRead.current = newest.id
      void markConversationRead(id, newest.id).catch((reason) => {
        latestRead.current = ""
        setError(errorText(reason))
      })
    }
    mark()
    window.addEventListener("focus", mark)
    document.addEventListener("visibilitychange", mark)
    return () => {
      window.removeEventListener("focus", mark)
      document.removeEventListener("visibilitychange", mark)
    }
  }, [messages, nearBottom, id, retry])
  function endTyping() {
    clearTimeout(typingTimer.current)
    if (!typingActive.current) return
    typingActive.current = false
    typingQueue.current = typingQueue.current
      .then(() => stopTyping(id))
      .catch((reason) => setError(errorText(reason)))
  }
  function changeText(text: string) {
    onDraft({ ...draft, text })
    if (!text.trim()) {
      endTyping()
      return
    }
    typingActive.current = true
    typingQueue.current = typingQueue.current
      .then(() => startTyping(id))
      .catch((reason) => setError(errorText(reason)))
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(endTyping, 4000)
  }
  async function send() {
    if (sendLock.current || busy || (!draft.text.trim() && !draft.file)) return
    sendLock.current = true
    onBusy(true)
    setError("")
    endTyping()
    try {
      if (draft.file) await sendAttachmentMessage(id, draft.file, draft.text)
      else await sendMessage(id, draft.text)
      onDraft({ text: "" })
      follow.current = true
      setNearBottom(true)
      setNewMessages(0)
      bottom.current?.scrollIntoView({ block: "end" })
    } catch (reason) {
      const message = errorText(reason)
      setError(message)
      onSendError(
        `Message could not be sent in ${title}: ${message}. Your draft has been kept.`
      )
    } finally {
      sendLock.current = false
      onBusy(false)
    }
  }
  return (
    <section
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
      aria-label={title}
    >
      <header className="chat-header">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to conversations"
            className="md:hidden"
            onClick={onBack}
          >
            <ArrowLeft size={19} />
          </Button>
          {conversation.type === "direct" ? (
            <Avatar
              key={profiles[other]?.avatarPath || other}
              uid={other}
              name={title}
            />
          ) : (
            <span
              aria-label="Group avatar"
              className="flex size-10 items-center justify-center rounded-full bg-muted"
            >
              <Users size={21} />
            </span>
          )}
          <h1 className="min-w-0 font-semibold break-words">{title}</h1>
        </div>
        {conversation.type === "group" && (
          <details>
            <summary className="cursor-pointer text-sm">
              {conversation.participants.length} participants
            </summary>
            <ul className="max-h-32 overflow-auto text-sm">
              {conversation.participants.map((member) => (
                <li key={member}>
                  {nameFor(member)}
                  {member === uid && " (you)"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </header>
      {error && (
        <div className="space-y-2 p-2">
          <ErrorNotice message={error} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setError("")
              setRetry((n) => n + 1)
            }}
          >
            Reconnect listeners
          </Button>
        </div>
      )}
      <div
        ref={scroll}
        className="message-history"
        onScroll={() => {
          const element = scroll.current
          if (element) {
            const near =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              80
            follow.current = near
            setNearBottom(near)
            if (near) setNewMessages(0)
          }
        }}
      >
        <div ref={content}>
          {loading ? (
            <div
              role="status"
              aria-label="Loading messages"
              className="skeleton-stack"
            >
              <i />
              <i />
              <i />
            </div>
          ) : !messages.length ? (
            <div className="chat-empty">
              <h2>Start something good.</h2>
              <p>Send the first message to say hello.</p>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Showing recent messages
            </p>
          )}
          {messages.map((message, index) => {
            const read = message.createdAt
              ? getMessageReadStatus(
                  message.createdAt,
                  message.senderId,
                  conversation.participants,
                  receipts
                )
              : null
            const status = !read
              ? "Sending…"
              : read.readByEveryone
                ? "Read by everyone"
                : read.readCount
                  ? `Read by ${read.readCount}`
                  : "Sent"
            return (
              <MessageItem
                key={message.id}
                conversationId={id}
                message={message}
                own={message.senderId === uid}
                sender={nameFor(message.senderId)}
                status={status}
                grouped={
                  index > 0 &&
                  messages[index - 1].senderId === message.senderId &&
                  !!message.createdAt &&
                  !!messages[index - 1].createdAt &&
                  message.createdAt.toMillis() -
                    messages[index - 1].createdAt.toMillis() <
                    300000
                }
              />
            )
          })}
          <div ref={bottom} />
        </div>
      </div>
      {!nearBottom && (
        <Button
          size="sm"
          variant="outline"
          className="new-message-indicator self-center"
          aria-live="polite"
          onClick={() => {
            follow.current = true
            setNearBottom(true)
            setNewMessages(0)
            bottom.current?.scrollIntoView({ block: "end" })
          }}
        >
          {newMessages
            ? `${newMessages} new ${newMessages === 1 ? "message" : "messages"} ↓`
            : "Jump to latest ↓"}
        </Button>
      )}
      <p className="typing-indicator" role="status">
        {typing.length ? `${typing.map(nameFor).join(", ")} typing…` : ""}
      </p>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        {draft.file && (
          <div className="composer-preview">
            <Paperclip size={16} />
            <span className="min-w-0 flex-1 truncate">{draft.file.name}</span>
            <button
              type="button"
              className="icon-action"
              disabled={busy}
              aria-label="Remove attachment"
              onClick={() => onDraft({ ...draft, file: undefined })}
            >
              <X size={17} />
            </button>
          </div>
        )}
        {emojiOpen && (
          <div className="composer-emojis" aria-label="Insert emoji">
            {["😊", "❤️", "😂", "👍", "🎉", "👋", "🙏", "😮"].map((emoji) => (
              <button
                type="button"
                key={emoji}
                aria-label={`Insert ${emoji}`}
                onClick={() => {
                  changeText(draft.text + emoji)
                  setEmojiOpen(false)
                  composer.current?.focus()
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div className="composer-row">
          <button
            type="button"
            className="icon-action"
            aria-label="Attach image, up to 10 MB"
            disabled={busy}
            onClick={() => upload.current?.click()}
          >
            <Paperclip size={20} />
          </button>
          <input
            ref={upload}
            className="sr-only"
            tabIndex={-1}
            type="file"
            aria-label="Image attachment"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ""
              if (file) {
                try {
                  validateAttachment(file)
                  onDraft({ ...draft, file })
                  setError("")
                } catch (reason) {
                  setError(errorText(reason))
                }
              }
            }}
          />
          <textarea
            ref={composer}
            rows={1}
            aria-label="Message"
            placeholder="Write a message…"
            maxLength={5000}
            disabled={busy}
            value={draft.text}
            onChange={(e) => changeText(e.target.value)}
            onBlur={endTyping}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEmojiOpen(false)
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing &&
                window.matchMedia("(hover: hover) and (pointer: fine)").matches
              ) {
                e.preventDefault()
                void send()
              }
            }}
          />
          <button
            type="button"
            className="icon-action"
            aria-label="Insert emoji"
            aria-expanded={emojiOpen}
            disabled={busy}
            onClick={() => setEmojiOpen((value) => !value)}
          >
            <Smile size={20} />
          </button>
          <Button
            type="submit"
            size="icon"
            className="send-button"
            aria-label={busy ? "Sending message" : "Send message"}
            disabled={busy || (!draft.text.trim() && !draft.file)}
          >
            {busy ? <span className="loading-dot" /> : <Send size={18} />}
          </Button>
        </div>
        {busy && (
          <p className="composer-status" role="status">
            {draft.file ? "Uploading your image…" : "Sending…"}
          </p>
        )}
      </form>
    </section>
  )
}
