import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  MoreHorizontal,
  SmilePlus,
  Pencil,
  Trash2,
  X,
  Copy,
} from "lucide-react"
import { ALLOWED_REACTIONS } from "../../services/reactionService"

export function MessageActions({
  open,
  onOpen,
  onClose,
  busy,
  onReact,
  onEdit,
  onDelete,
  onCopy,
}: {
  open: boolean
  onOpen: () => void
  onClose: () => void
  busy: boolean
  onReact: (emoji: string) => void
  onEdit?: () => void
  onDelete?: () => void
  onCopy?: () => void
}) {
  const anchor = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{
    left: number
    top: number
  } | null>(null)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const keepToolbar = () => clearTimeout(dismissTimer.current)
  const hideToolbar = () => {
    clearTimeout(dismissTimer.current)
    dismissTimer.current = setTimeout(() => setPosition(null), 160)
  }
  useEffect(() => {
    const row = anchor.current?.parentElement
    if (!row) return
    const show = () => {
      clearTimeout(dismissTimer.current)
      const rect = row.getBoundingClientRect()
      const left = row.classList.contains("outgoing")
        ? rect.right - 270
        : rect.left
      setPosition({
        left: Math.max(8, Math.min(left, window.innerWidth - 278)),
        top:
          rect.top > 54
            ? rect.top - 46
            : Math.min(rect.bottom + 4, window.innerHeight - 48),
      })
    }
    const enter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") show()
    }
    const leave = () => {
      dismissTimer.current = setTimeout(() => setPosition(null), 160)
    }
    const dismiss = () => setPosition(null)
    row.addEventListener("pointerenter", enter)
    row.addEventListener("pointerleave", leave)
    row.addEventListener("focusin", show)
    row.addEventListener("focusout", leave)
    window.addEventListener("scroll", dismiss, true)
    window.addEventListener("resize", dismiss)
    return () => {
      clearTimeout(dismissTimer.current)
      row.removeEventListener("pointerenter", enter)
      row.removeEventListener("pointerleave", leave)
      row.removeEventListener("focusin", show)
      row.removeEventListener("focusout", leave)
      window.removeEventListener("scroll", dismiss, true)
      window.removeEventListener("resize", dismiss)
    }
  }, [])
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (!open || !element) return
    const rect = anchor.current?.parentElement?.getBoundingClientRect()
    element.style.left = `${Math.max(12, Math.min(rect?.left || 12, window.innerWidth - 292))}px`
    element.showModal()
    const viewport = window.visualViewport
    const top = viewport?.offsetTop || 0
    const height = viewport?.height || window.innerHeight
    element.style.top = `${Math.max(top + 12, Math.min((rect?.bottom || top) + 6, top + height - element.getBoundingClientRect().height - 12))}px`
    const dismiss = () => onClose()
    window.addEventListener("resize", dismiss)
    return () => {
      element.close()
      window.removeEventListener("resize", dismiss)
    }
  }, [open, onClose])
  return (
    <>
      <span ref={anchor} />
      {position &&
        !open &&
        createPortal(
          <div
            className="message-toolbar floating-toolbar"
            style={position}
            role="toolbar"
            aria-label="Message actions"
            onPointerEnter={keepToolbar}
            onPointerLeave={hideToolbar}
            onFocus={keepToolbar}
            onBlur={hideToolbar}
            onKeyDown={(e) => {
              if (e.key === "Escape") setPosition(null)
            }}
          >
            {["❤️", "😂", "😮", "👍"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                disabled={busy}
                aria-label={`React ${emoji}`}
                onClick={() => onReact(emoji)}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              disabled={busy}
              aria-label="More reactions"
              onClick={onOpen}
            >
              <SmilePlus size={16} />
            </button>
            <button
              type="button"
              aria-label="More message actions"
              onClick={onOpen}
            >
              <MoreHorizontal size={16} />
            </button>
          </div>,
          document.body
        )}
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            className="message-menu"
            aria-label="Message reactions and actions"
            onCancel={onClose}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                const r = e.currentTarget.getBoundingClientRect()
                if (
                  e.clientX < r.left ||
                  e.clientX > r.right ||
                  e.clientY < r.top ||
                  e.clientY > r.bottom
                )
                  onClose()
              }
            }}
          >
            <div className="flex items-center justify-between pb-2">
              <strong className="text-sm">React to message</strong>
              <button
                type="button"
                className="icon-action"
                aria-label="Close actions"
                onClick={onClose}
              >
                <X size={16} />
              </button>
            </div>
            <div className="emoji-grid">
              {ALLOWED_REACTIONS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  disabled={busy}
                  aria-label={`React ${emoji}`}
                  onClick={() => onReact(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="menu-actions">
              {onCopy && (
                <button type="button" disabled={busy} onClick={onCopy}>
                  <Copy size={17} />
                  Copy text
                </button>
              )}
              {onEdit && (
                <button type="button" disabled={busy} onClick={onEdit}>
                  <Pencil size={17} />
                  Edit message
                </button>
              )}
              {onDelete && (
                <button type="button" disabled={busy} onClick={onDelete}>
                  <Trash2 size={17} />
                  Delete message
                </button>
              )}
            </div>
          </dialog>,
          document.body
        )}
    </>
  )
}
