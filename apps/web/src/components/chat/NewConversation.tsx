import { ArrowLeft, Search, Users, MessageCircle, Check, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  searchPublicProfiles,
  type PublicProfile,
} from "../../services/publicProfileService"
import {
  createDirectConversation,
  createGroupConversation,
} from "../../services/conversationService"
import { Avatar } from "./Avatar"
import { ErrorNotice, errorText } from "./feedback"

export function NewConversation({
  onOpen,
  onClose,
}: {
  onOpen: (id: string) => void
  onClose: () => void
}) {
  const createLock = useRef(false)
  const [term, setTerm] = useState("")
  const [results, setResults] = useState<PublicProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [group, setGroup] = useState(false)
  const [name, setName] = useState("")
  const [members, setMembers] = useState<PublicProfile[]>([])
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      setLoading(true)
      setError("")
      searchPublicProfiles(term)
        .then((profiles) => {
          if (active) setResults(profiles)
        })
        .catch((reason) => {
          if (active) {
            setResults([])
            setError(errorText(reason))
          }
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 300)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [term, retry])
  async function create(profile?: PublicProfile) {
    if (createLock.current) return
    createLock.current = true
    setBusy(true)
    setError("")
    try {
      onOpen(
        profile
          ? await createDirectConversation(profile.uid)
          : await createGroupConversation(
              name,
              members.map((member) => member.uid)
            )
      )
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      createLock.current = false
      setBusy(false)
    }
  }
  return (
    <section className="detail-screen" aria-label="New conversation">
      <header className="detail-header">
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          <ArrowLeft size={18} />
          Back to conversations
        </Button>
        <h1>{group ? "Create a group" : "Start a conversation"}</h1>
        <p>
          {group
            ? "Bring your people together in one place."
            : "Find someone by their public display name."}
        </p>
      </header>
      <div className="detail-body search-body">
        <div className="conversation-modes" aria-label="Conversation type">
          <button
            type="button"
            disabled={busy}
            aria-pressed={!group}
            onClick={() => setGroup(false)}
          >
            <MessageCircle size={17} />
            Direct message
          </button>
          <button
            type="button"
            disabled={busy}
            aria-pressed={group}
            onClick={() => setGroup(true)}
          >
            <Users size={17} />
            Create group
          </button>
        </div>
        {group && (
          <div className="group-setup">
            <label>
              Group name
              <Input
                value={name}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="Give your group a name"
              />
            </label>
            <div
              className="selected-members"
              aria-label="Selected group members"
            >
              {members.map((member) => (
                <button
                  type="button"
                  key={member.uid}
                  disabled={busy}
                  aria-label={`Remove ${member.displayName}`}
                  onClick={() =>
                    setMembers((current) =>
                      current.filter((item) => item.uid !== member.uid)
                    )
                  }
                >
                  <span className="truncate">{member.displayName}</span>
                  <X size={14} />
                </button>
              ))}
            </div>
            <p className="field-help">
              {members.length
                ? `${members.length} selected · you will also be included`
                : "Search below to select at least one other member."}
            </p>
          </div>
        )}
        <label className="people-search">
          <Search size={19} />
          <Input
            autoFocus
            aria-label="Search by display name"
            value={term}
            disabled={busy}
            placeholder="Search by display name"
            onChange={(e) => {
              setTerm(e.target.value)
              setResults([])
              setLoading(true)
            }}
          />
        </label>
        <ErrorNotice message={error} />
        {error && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry search
          </Button>
        )}
        <div className="search-results-header">
          <h2>{group ? "ADD PEOPLE" : "PEOPLE"}</h2>
          {busy && <span role="status">Opening conversation…</span>}
        </div>
        {loading ? (
          <div className="skeleton-stack" role="status" aria-label="Searching">
            <i />
            <i />
          </div>
        ) : (
          !error &&
          !results.length && (
            <div className="people-empty">
              <Search size={25} />
              <h3>
                {term.trim().length >= 2
                  ? "No matching people"
                  : "Who would you like to talk to?"}
              </h3>
              <p>
                {term.trim().length >= 2
                  ? "Try another display name."
                  : "Enter at least two characters to find someone."}
              </p>
            </div>
          )
        )}
        <ul className="people-results">
          {results.map((profile) => {
            const selected = members.some(
              (member) => member.uid === profile.uid
            )
            return (
              <li key={profile.uid}>
                <Avatar uid={profile.uid} name={profile.displayName} />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate">
                    {profile.displayName}
                  </strong>
                  {profile.bio && <p className="truncate">{profile.bio}</p>}
                </div>
                <Button
                  variant={group ? "outline" : "default"}
                  aria-pressed={group ? selected : undefined}
                  disabled={busy}
                  onClick={() =>
                    group
                      ? setMembers((current) =>
                          selected
                            ? current.filter(
                                (member) => member.uid !== profile.uid
                              )
                            : [...current, profile]
                        )
                      : void create(profile)
                  }
                >
                  {group ? (
                    selected ? (
                      <>
                        <Check size={16} />
                        Selected
                      </>
                    ) : (
                      "Add"
                    )
                  ) : (
                    "Message"
                  )}
                </Button>
              </li>
            )
          })}
        </ul>
        {group && (
          <footer className="form-actions">
            <Button
              disabled={busy || !name.trim() || !members.length}
              onClick={() => void create()}
            >
              <Users size={17} />
              {busy ? "Creating…" : "Create group"}
            </Button>
          </footer>
        )}
      </div>
    </section>
  )
}
