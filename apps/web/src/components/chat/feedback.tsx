import { uiCopy } from "../ui-copy"
export function errorText(error: unknown): string {
  if (import.meta.env.DEV) console.error(error)
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : ""
  if (code.includes("permission-denied"))
    return "You do not have permission for this action. Check your account or contact support."
  if (code.includes("network") || code.includes("unavailable"))
    return uiCopy.connectionError
  return error instanceof Error ? error.message : uiCopy.unexpectedError
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <p
      role="alert"
      className="rounded border border-destructive p-2 text-sm text-destructive"
    >
      {message}
    </p>
  ) : null
}
