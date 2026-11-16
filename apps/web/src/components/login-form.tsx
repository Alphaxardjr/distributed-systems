import { uiCopy } from "./ui-copy"
import { errorText } from "./chat/feedback"

import { useState, type ComponentProps, type FormEvent } from "react"
import { cn } from "cn"

import { loginUser } from "../services/authService"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

export function LoginForm({ className, ...props }: ComponentProps<"div">) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await loginUser(email.trim(), password)
    } catch (err: unknown) {
      const message = errorText(err)
      setError(
        message.includes("auth/invalid-credential")
          ? "Invalid email or password. Please try again."
          : message
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="auth-card">
        <CardHeader>
          <CardTitle>{uiCopy.loginTitle}</CardTitle>
          <CardDescription>{uiCopy.loginHint}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </Field>

              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                </div>

                <Input
                  placeholder="Enter your password"
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </Field>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Field>
                <Button type="submit" disabled={loading}>
                  {loading ? "Logging in..." : "Log in"}
                </Button>

                <FieldDescription className="text-center">
                  New around here? <a href="#/signup">Create an account</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
