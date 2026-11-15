import { useEffect, useState } from "react"
import { getMyAvatarUrl, getUserAvatarUrl } from "../../services/avatarService"
import { errorText } from "./feedback"

export function Avatar({
  uid,
  name,
  own = false,
  version = 0,
  compact = false,
  size = "default",
}: {
  uid: string
  name: string
  own?: boolean
  version?: number
  compact?: boolean
  size?: "default" | "large"
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    const refresh = () => {
      ;(own ? getMyAvatarUrl() : getUserAvatarUrl(uid))
        .then((value) => {
          if (active) {
            setUrl(value)
            setError("")
          }
        })
        .catch((reason) => {
          if (active) {
            setUrl(null)
            setError(errorText(reason))
          }
        })
    }
    refresh()
    // Signed URLs are temporary; renew while mounted and on returning to the app.
    const timer = window.setInterval(refresh, 4 * 60 * 1000)
    window.addEventListener("focus", refresh)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [uid, own, version, retry])
  return (
    <span
      title={error || undefined}
      className={`inline-flex shrink-0 flex-col items-center ${size === "large" ? "profile-avatar" : ""}`}
    >
      {url ? (
        <img
          src={url}
          alt={`${name}'s avatar`}
          className="size-10 rounded-full object-cover"
          onError={() => {
            setUrl(null)
            setError("Avatar unavailable or expired.")
          }}
        />
      ) : (
        <span
          aria-label={`${name}'s avatar`}
          className="flex size-10 items-center justify-center rounded-full bg-muted"
        >
          {name.slice(0, 1).toUpperCase() || "?"}
        </span>
      )}
      {error && !compact && (
        <button
          type="button"
          title={error}
          className="text-xs underline"
          onClick={() => setRetry((n) => n + 1)}
        >
          Retry avatar
        </button>
      )}
    </span>
  )
}
