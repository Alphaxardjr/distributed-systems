export function errorText(error: unknown): string {
  if (import.meta.env.DEV) console.error(error)
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : ""
  if (code.includes("permission-denied"))
    return "You do not have permission for this action. Check your account or contact support."
  if (code.includes("network") || code.includes("unavailable"))
    return "Cannot reach the server. Check your connection and try again."
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again."
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
