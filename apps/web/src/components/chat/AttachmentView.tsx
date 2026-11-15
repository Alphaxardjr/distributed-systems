import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Download, File, X, Expand } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  getAttachmentUrl,
  downloadAttachment,
  formatFileSize,
} from "../../services/attachmentService"
import type { ChatAttachment } from "../../types/chat"
import { ErrorNotice, errorText } from "./feedback"

export function AttachmentView({
  conversationId,
  attachment,
}: {
  conversationId: string
  attachment: ChatAttachment
}) {
  const image = attachment.contentType.startsWith("image/")
  const [url, setUrl] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState("")
  const [downloadError, setDownloadError] = useState("")
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const downloadLock = useRef(false)
  useEffect(() => {
    if (!image) return
    let active = true
    getAttachmentUrl(conversationId, attachment.storagePath)
      .then((value) => {
        if (active) {
          setUrl(value)
          setError("")
        }
      })
      .catch((reason) => {
        if (active) setError(errorText(reason))
      })
    return () => {
      active = false
    }
  }, [conversationId, attachment.storagePath, retry, image])
  useEffect(() => {
    const element = dialog.current
    if (!preview || !element) return
    element.showModal()
    return () => element.close()
  }, [preview])
  function refresh() {
    setError("")
    setUrl("")
    setLoaded(false)
    setRetry((n) => n + 1)
  }
  async function download() {
    if (downloadLock.current) return
    downloadLock.current = true
    setBusy(true)
    setDownloadError("")
    try {
      const blob = await downloadAttachment(conversationId, attachment)
      const local = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = local
      link.download = attachment.name
      link.click()
      setTimeout(() => URL.revokeObjectURL(local), 1000)
    } catch (reason) {
      setDownloadError(errorText(reason))
    } finally {
      downloadLock.current = false
      setBusy(false)
    }
  }
  const unavailable = () =>
    setError(
      "This image is unavailable or its link has expired. Refresh to try again."
    )
  return (
    <div className={image ? "image-attachment" : "file-attachment"}>
      {image ? (
        <>
          <button
            type="button"
            className="attachment-frame"
            disabled={!loaded || !!error}
            aria-label={`Open larger preview of ${attachment.name}`}
            onClick={() => {
              setPreview(true)
              refresh()
            }}
          >
            {(!loaded || error) && (
              <span className="attachment-placeholder" role="status">
                {error ? "Image unavailable" : "Loading image…"}
              </span>
            )}
            {url && !error && (
              <img
                src={url}
                alt={attachment.name}
                onLoad={() => setLoaded(true)}
                onError={unavailable}
              />
            )}
            {loaded && !error && (
              <span className="attachment-expand">
                <Expand size={17} />
              </span>
            )}
          </button>
          <ErrorNotice message={error} />
          {error && (
            <Button size="sm" variant="outline" onClick={refresh}>
              Refresh image
            </Button>
          )}
        </>
      ) : (
        <File size={26} className="shrink-0" />
      )}
      <div className="attachment-details">
        <div className="min-w-0 flex-1">
          <p className="truncate" title={attachment.name}>
            {attachment.name}
          </p>
          <span>{formatFileSize(attachment.size)}</span>
        </div>
        <button
          type="button"
          className="icon-action"
          disabled={busy}
          aria-label={`Download ${attachment.name}`}
          onClick={() => void download()}
        >
          {busy ? <span className="loading-dot" /> : <Download size={17} />}
        </button>
      </div>
      <ErrorNotice message={downloadError} />
      {preview &&
        createPortal(
          <dialog
            ref={dialog}
            className="image-preview"
            aria-label={`Image preview: ${attachment.name}`}
            onCancel={() => setPreview(false)}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                const r = e.currentTarget.getBoundingClientRect()
                if (
                  e.clientX < r.left ||
                  e.clientX > r.right ||
                  e.clientY < r.top ||
                  e.clientY > r.bottom
                )
                  setPreview(false)
              }
            }}
          >
            <header>
              <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
              <button
                type="button"
                className="icon-action"
                disabled={busy}
                aria-label="Download image"
                onClick={() => void download()}
              >
                <Download size={19} />
              </button>
              <button
                autoFocus
                type="button"
                className="icon-action"
                aria-label="Close image preview"
                onClick={() => setPreview(false)}
              >
                <X size={21} />
              </button>
            </header>
            <div className="image-preview-content">
              {url && !error ? (
                <img src={url} alt={attachment.name} onError={unavailable} />
              ) : (
                <p role="status">
                  {error ? "Image unavailable" : "Loading image…"}
                </p>
              )}
            </div>
            <ErrorNotice message={error || downloadError} />
            {error && (
              <Button variant="outline" onClick={refresh}>
                Refresh image
              </Button>
            )}
          </dialog>,
          document.body
        )}
    </div>
  )
}
