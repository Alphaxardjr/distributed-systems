import { uiCopy } from "../ui-copy"
import { useRef, useState, type FormEvent } from "react"
import { ArrowLeft, Camera, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { PublicProfile } from "../../services/publicProfileService"
import { updatePublicProfile } from "../../services/publicProfileService"
import {
  uploadProfilePicture,
  removeProfilePicture,
} from "../../services/avatarService"
import { Avatar } from "./Avatar"
import { ErrorNotice, errorText } from "./feedback"

export function ProfileSettings({
  profile,
  onClose,
}: {
  profile: PublicProfile
  onClose: () => void
}) {
  const [name, setName] = useState(profile.displayName)
  const [bio, setBio] = useState(profile.bio)
  const [operation, setOperation] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [version, setVersion] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  const busy = !!operation
  async function run(
    action: () => Promise<unknown>,
    success: string,
    label: string
  ) {
    if (lock.current) return
    lock.current = true
    setOperation(label)
    setError("")
    setNotice("")
    try {
      await action()
      setVersion((v) => v + 1)
      setNotice(success)
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      lock.current = false
      setOperation("")
    }
  }
  function save(event: FormEvent) {
    event.preventDefault()
    void run(
      () => updatePublicProfile({ displayName: name, bio }),
      uiCopy.profileSaved,
      "Saving profile…"
    )
  }
  return (
    <section className="detail-screen" aria-label="Profile settings">
      <header className="detail-header">
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          <ArrowLeft size={18} />
          Back to conversations
        </Button>
        <h1>{uiCopy.profileTitle}</h1>
        <p>{uiCopy.profileHint}</p>
      </header>
      <div className="detail-body profile-body">
        <div className="profile-photo-section">
          <Avatar
            uid={profile.uid}
            name={name}
            own
            version={version}
            size="large"
          />
          <div>
            <h2>Profile photo</h2>
            <p>JPEG, PNG or WebP · Up to 5 MB</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                <Camera size={16} />
                Change photo
              </Button>
              <Button
                variant="ghost"
                disabled={busy || !profile.avatarPath}
                onClick={() =>
                  void run(
                    removeProfilePicture,
                    "Profile photo removed.",
                    "Removing photo…"
                  )
                }
              >
                <Trash2 size={16} />
                Remove photo
              </Button>
            </div>
          </div>
        </div>
        <input
          ref={input}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose profile photo"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file)
              void run(
                () => uploadProfilePicture(file),
                "Profile photo updated.",
                "Uploading photo…"
              )
          }}
        />
        <ErrorNotice message={error} />
        {(notice || busy) && (
          <p className="save-feedback" role="status">
            {busy ? operation : notice}
          </p>
        )}
        <form onSubmit={save} className="profile-form">
          <label>
            Display name
            <Input
              required
              maxLength={50}
              value={name}
              disabled={busy}
              placeholder="How people know you"
              onChange={(e) => setName(e.target.value)}
            />
            <span className="field-help">
              Visible to other people on Chatly.
            </span>
          </label>
          <label>
            Bio
            <textarea
              maxLength={200}
              value={bio}
              disabled={busy}
              placeholder="Tell people a little about yourself"
              onChange={(e) => setBio(e.target.value)}
            />
            <span className="field-help">{bio.length}/200 characters</span>
          </label>
          <footer className="form-actions">
            <Button type="submit" disabled={busy || !name.trim()}>
              {operation === "Saving profile…" ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
          </footer>
        </form>
      </div>
    </section>
  )
}
