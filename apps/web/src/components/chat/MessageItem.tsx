import { useCallback, useEffect, useRef, useState } from "react"
import { MoreHorizontal, CheckCheck } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { ChatMessage } from "../../types/chat"
import {
  editMessage,
  deleteMessage,
} from "../../services/messageManagementService"
import {
  addReaction,
  removeReaction,
  subscribeToReactions,
  getReactionSummary,
  type MessageReaction,
} from "../../services/reactionService"
import { AttachmentView } from "./AttachmentView"
import { MessageActions } from "./MessageActions"
import { ErrorNotice, errorText } from "./feedback"

export function MessageItem({
  conversationId,
  message,
  own,
  sender,
  status,
  grouped = false,
}: {
  conversationId: string
  message: ChatMessage
  own: boolean
  sender: string
  status: string
  grouped?: boolean
}) {
  const [reactions, setReactions] = useState<MessageReaction[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(message.text)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [notice, setNotice] = useState("")
  const [menu, setMenu] = useState(false)
  const close = useCallback(() => setMenu(false), [])
  const press = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const origin = useRef({ x: 0, y: 0 })
  const cancelPress = () => clearTimeout(press.current)
  useEffect(() => {
    const cancel = () => clearTimeout(press.current)
    window.addEventListener("scroll", cancel, true)
    return () => {
      cancel()
      window.removeEventListener("scroll", cancel, true)
    }
  }, [])
  useEffect(() => {
    if (message.deletedAt) return
    return subscribeToReactions(
      conversationId,
      message.id,
      setReactions,
      (reason) => setError(errorText(reason))
    )
  }, [conversationId, message.id, message.deletedAt])
  async function run(action: () => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError("")
    try {
      await action()
      setEditing(false)
      setConfirmDelete(false)
      close()
    } catch (reason) {
      close()
      setError(errorText(reason))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const summary = getReactionSummary(reactions)
  const react = (emoji: string) =>
    void run(() =>
      summary.some((item) => item.emoji === emoji && item.reactedByMe)
        ? removeReaction(conversationId, message.id)
        : addReaction(conversationId, message.id, emoji)
    )
  return (
    <article
      className={`message-row ${own ? "outgoing" : "incoming"} ${grouped ? "grouped" : ""}`}
      data-message-id={message.id}
      aria-label={`Message from ${sender}`}
    >
      {!message.deletedAt && (
        <MessageActions
          open={menu}
          onOpen={() => setMenu(true)}
          onClose={close}
          busy={busy}
          onReact={react}
          onCopy={
            message.text
              ? () =>
                  void run(async () => {
                    await navigator.clipboard.writeText(message.text)
                    setNotice("Text copied.")
                  })
              : undefined
          }
          onEdit={
            own && message.type === "text"
              ? () => {
                  setText(message.text)
                  setEditing(true)
                  close()
                }
              : undefined
          }
          onDelete={
            own && ["text", "image", "gif"].includes(message.type)
              ? () => {
                  setConfirmDelete(true)
                  close()
                }
              : undefined
          }
        />
      )}
      {!grouped && <p className="message-sender">{own ? "You" : sender}</p>}
      <div
        className="message-bubble"
        onPointerDown={(e) => {
          if (
            e.pointerType === "mouse" ||
            message.deletedAt ||
            (e.target as HTMLElement).closest("button,a,input,textarea")
          )
            return
          cancelPress()
          origin.current = { x: e.clientX, y: e.clientY }
          if (!e.isPrimary) return
          press.current = setTimeout(() => {
            if (!window.getSelection()?.toString()) setMenu(true)
          }, 450)
        }}
        onPointerMove={(e) => {
          if (
            Math.hypot(
              e.clientX - origin.current.x,
              e.clientY - origin.current.y
            ) > 10
          )
            cancelPress()
        }}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
        onContextMenu={(e) => {
          if (menu) e.preventDefault()
        }}
      >
        {message.deletedAt ? (
          <p className="italic opacity-75">Message deleted</p>
        ) : (
          <>
            {message.attachment && (
              <AttachmentView
                conversationId={conversationId}
                attachment={message.attachment}
              />
            )}
            {editing ? (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void run(() => editMessage(conversationId, message.id, text))
                }}
              >
                <textarea
                  autoFocus
                  aria-label="Edit message"
                  className="w-full rounded border bg-background p-2 text-foreground"
                  value={text}
                  maxLength={5000}
                  disabled={busy}
                  onChange={(e) => setText(e.target.value)}
                />
                <Button type="submit" size="sm" disabled={busy || !text.trim()}>
                  Save
                </Button>{" "}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              </form>
            ) : (
              <p className="message-text">
                {message.text
                  .split(/(https?:\/\/[^\s]+)/g)
                  .map((part, index) =>
                    /^https?:\/\//.test(part) ? (
                      <a
                        key={index}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                      >
                        {part}
                      </a>
                    ) : (
                      part
                    )
                  )}
              </p>
            )}
            {confirmDelete && (
              <div className="mt-3 space-y-2">
                <p>Delete this message?</p>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(() => deleteMessage(conversationId, message.id))
                  }
                >
                  Delete
                </Button>{" "}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </>
        )}
        <div className="message-meta">
          <time title={message.createdAt?.toDate().toLocaleString()}>
            {message.createdAt
              ? message.createdAt.toDate().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Sending…"}
          </time>
          {message.editedAt && <span>edited</span>}
          {own && (
            <span title={status} aria-label={status}>
              {status.startsWith("Read") ? <CheckCheck size={14} /> : status}
            </span>
          )}
          {!message.deletedAt && (
            <button
              type="button"
              className="message-access"
              aria-label="Open message actions"
              aria-haspopup="dialog"
              aria-expanded={menu}
              onClick={() => setMenu(true)}
            >
              <MoreHorizontal size={17} />
            </button>
          )}
        </div>
      </div>
      {!message.deletedAt && summary.length > 0 && (
        <div className="reaction-badges">
          {summary.map((item) => (
            <button
              key={item.emoji}
              type="button"
              aria-pressed={item.reactedByMe}
              aria-label={`${item.emoji}, ${item.count} reactions${item.reactedByMe ? ", yours; remove reaction" : "; add reaction"}`}
              disabled={busy}
              onClick={() => react(item.emoji)}
            >
              {item.emoji}
              <span>{item.count}</span>
            </button>
          ))}
        </div>
      )}
      {notice && (
        <p className="text-xs text-muted-foreground" role="status">
          {notice}
        </p>
      )}
      <ErrorNotice message={error} />
    </article>
  )
}
