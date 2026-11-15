import {
  MessageCircle,
  Search,
  SquarePen,
  Settings,
  LogOut,
  Moon,
  Sun,
  Users,
} from "lucide-react"
import { useTheme } from "../theme-provider"
import "./chat.css"
import { useEffect, useState } from "react"
import type { User } from "firebase/auth"
import { Button } from "@workspace/ui/components/button"
import { ensurePublicProfile } from "../../services/publicProfileService"
import {
  subscribeToConversations,
  type ConversationListItem,
} from "../../services/conversationListService"
import { logoutUser } from "../../services/authService"
import { useProfiles } from "./useProfiles"
import { Avatar } from "./Avatar"
import { ProfileSettings } from "./ProfileSettings"
import { NewConversation } from "./NewConversation"
import { ConversationView, type Draft } from "./ConversationView"
import { ErrorNotice, errorText } from "./feedback"

export function ChatApp({ user }: { user: User }) {
  const { theme, setTheme } = useTheme()
  useEffect(() => {
    const viewport = window.visualViewport
    const resize = () =>
      document.documentElement.style.setProperty(
        "--chat-height",
        `${viewport?.height || window.innerHeight}px`
      )
    resize()
    viewport?.addEventListener("resize", resize)
    return () => {
      viewport?.removeEventListener("resize", resize)
      document.documentElement.style.removeProperty("--chat-height")
    }
  }, [])
  const [filter, setFilter] = useState("")
  const [ready, setReady] = useState(false)
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [screen, setScreen] = useState<"chat" | "new" | "profile">("chat")
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [sending, setSending] = useState<Record<string, boolean>>({})
  const [loggingOut, setLoggingOut] = useState(false)
  const { profiles, error: profileError } = useProfiles(
    ready
      ? [user.uid, ...conversations.flatMap((item) => item.participants)]
      : [],
    retry
  )
  useEffect(() => {
    let active = true
    ensurePublicProfile()
      .then(() => {
        if (active) {
          setReady(true)
          setError("")
        }
      })
      .catch((reason) => {
        if (active) setError(errorText(reason))
      })
    return () => {
      active = false
    }
  }, [retry])
  useEffect(() => {
    if (!ready) return
    return subscribeToConversations(
      (items) => {
        setConversations(items)
        setLoading(false)
      },
      (reason) => {
        setError(errorText(reason))
        setLoading(false)
      }
    )
  }, [ready, retry])
  const ownProfile = profiles[user.uid]
  const current = conversations.find((item) => item.id === selected)
  const name = ownProfile?.displayName || user.displayName || "Your profile"
  const detail = screen !== "chat" || selected !== null
  async function logout() {
    setLoggingOut(true)
    try {
      await logoutUser()
    } catch (reason) {
      setError(errorText(reason))
      setLoggingOut(false)
    }
  }
  const errors = (
    <>
      <ErrorNotice message={error || profileError} />
      {(error || profileError) && (
        <Button
          variant="outline"
          onClick={() => {
            setError("")
            setRetry((n) => n + 1)
          }}
        >
          Retry connection
        </Button>
      )}
    </>
  )
  if (!ready)
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-xl">Preparing your Chatly profile</h1>
        {errors}
        {!error && <p role="status">Loading…</p>}
        <Button disabled={loggingOut} onClick={() => void logout()}>
          Log out
        </Button>
      </main>
    )
  return (
    <main className="chat-shell flex min-h-0 overflow-hidden bg-background text-foreground">
      <aside
        className={`${detail ? "hidden md:flex" : "flex"} chat-sidebar min-h-0 w-full flex-col border-r md:w-80 md:shrink-0`}
        aria-label="Conversations"
      >
        <header className="sidebar-header">
          <div className="flex items-center justify-between">
            <h1 className="chat-brand">
              <MessageCircle size={24} fill="currentColor" />
              <span>
                Chatly<span className="brand-dot">.</span>
              </span>
            </h1>
            <Button
              size="icon"
              variant="ghost"
              aria-label="New conversation"
              onClick={() => setScreen("new")}
            >
              <SquarePen size={20} />
            </Button>
          </div>
          <label className="sidebar-search">
            <Search size={17} />
            <input
              aria-label="Filter conversations"
              placeholder="Search your conversations"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <div className="flex items-center justify-between">
            <h2 className="section-label">MESSAGES</h2>
            <button
              className="text-xs font-medium text-primary"
              onClick={() => setScreen("new")}
            >
              Find people
            </button>
          </div>
        </header>
        <div className="space-y-2 p-2">{errors}</div>
        <nav className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading && (
            <div
              className="skeleton-stack"
              role="status"
              aria-label="Loading conversations"
            >
              <i />
              <i />
              <i />
            </div>
          )}
          {!loading && !conversations.length && (
            <p className="p-2 text-sm">
              No conversations yet. Search for someone to start chatting.
            </p>
          )}
          {conversations.map((item) => {
            const recipient =
              item.participants.find((id) => id !== user.uid) || user.uid
            const title =
              item.type === "group"
                ? item.name || "Unnamed group"
                : profiles[recipient]?.displayName || "Loading profile…"
            if (!title.toLowerCase().includes(filter.toLowerCase())) return null
            const last = item.lastMessage
            return (
              <button
                key={item.id}
                type="button"
                aria-current={selected === item.id ? "page" : undefined}
                className={`conversation-item ${selected === item.id ? "selected" : ""}`}
                onClick={() => {
                  setSelected(item.id)
                  setScreen("chat")
                }}
              >
                {item.type === "group" ? (
                  <span className="group-avatar">
                    <Users size={21} />
                  </span>
                ) : (
                  <Avatar uid={recipient} name={title} compact />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.type === "group" && "Group · "}
                    {last
                      ? last.isDeleted
                        ? "Message deleted"
                        : last.text || `[${last.type}]`
                      : "No messages yet"}
                  </span>
                </span>
                {item.unreadCount > 0 && (
                  <span
                    className="unread-badge"
                    aria-label={`${item.unreadCount} unread messages`}
                  >
                    {item.unreadCount}
                  </span>
                )}
              </button>
            )
          })}
          {filter && (
            <button
              type="button"
              className="search-people-link"
              onClick={() => setScreen("new")}
            >
              Search for people outside your chats <Search size={15} />
            </button>
          )}
        </nav>
        <footer className="sidebar-footer">
          <Avatar
            key={ownProfile?.avatarPath || "no-avatar"}
            uid={user.uid}
            name={name}
            own
          />
          <button
            className="min-w-0 flex-1 text-left"
            onClick={() => setScreen("profile")}
          >
            <strong className="block truncate text-sm">{name}</strong>
            <span className="text-xs text-muted-foreground">Your profile</span>
          </button>
          <button
            className="icon-action"
            aria-label="Profile settings"
            onClick={() => setScreen("profile")}
          >
            <Settings size={18} />
          </button>
          <button
            className="icon-action"
            aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="icon-action"
            aria-label="Log out"
            disabled={loggingOut}
            onClick={() => void logout()}
          >
            <LogOut size={18} />
          </button>
        </footer>
      </aside>
      <div
        className={`${detail ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col overflow-auto`}
      >
        <div className="space-y-2 p-2 md:hidden">{errors}</div>
        {screen === "new" ? (
          <NewConversation
            onClose={() => setScreen("chat")}
            onOpen={(id) => {
              setSelected(id)
              setScreen("chat")
            }}
          />
        ) : screen === "profile" ? (
          ownProfile ? (
            <ProfileSettings
              profile={ownProfile}
              onClose={() => setScreen("chat")}
            />
          ) : (
            <div className="p-4">
              <Button onClick={() => setScreen("chat")}>Back to chats</Button>
              <p role="status">Loading profile…</p>
              {errors}
            </div>
          )
        ) : current ? (
          <ConversationView
            key={current.id}
            conversation={current}
            onSendError={setError}
            busy={sending[current.id] || false}
            onBusy={(value) =>
              setSending((previous) => ({ ...previous, [current.id]: value }))
            }
            uid={user.uid}
            profiles={profiles}
            draft={drafts[current.id] || { text: "" }}
            onDraft={(draft) =>
              setDrafts((previous) => ({ ...previous, [current.id]: draft }))
            }
            onBack={() => setSelected(null)}
          />
        ) : (
          <div className="chat-empty m-auto">
            <MessageCircle size={42} className="mx-auto mb-5 text-primary" />
            <h2>Your conversations, connected.</h2>
            <p>
              {selected
                ? "Waiting for the conversation. If access has changed, select another chat."
                : "Select a conversation or start a new one."}
            </p>
            <Button onClick={() => setScreen("new")}>New conversation</Button>
            {selected && (
              <Button variant="outline" onClick={() => setSelected(null)}>
                Back to chats
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
