import { MessageCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { useAuth } from "./contexts/AuthContext"
import { LoginForm } from "./components/login-form"
import { SignupForm } from "./components/signup-form"
import { ChatApp } from "./components/chat/ChatApp"

export function App() {
  const { user, loading, error } = useAuth()
  const [route, setRoute] = useState(window.location.hash)
  const [registering, setRegistering] = useState(false)
  useEffect(() => {
    const change = () => setRoute(window.location.hash)
    window.addEventListener("hashchange", change)
    return () => window.removeEventListener("hashchange", change)
  }, [])
  if (loading)
    return (
      <main className="p-6" role="status">
        Restoring your session…
      </main>
    )
  if (error)
    return (
      <main className="p-6">
        <p role="alert">{error}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </main>
    )
  if (user && !registering) return <ChatApp key={user.uid} user={user} />
  return (
    <main className="auth-shell dark">
      <div className="auth-content">
        <div className="chat-brand auth-brand">
          <MessageCircle size={24} fill="currentColor" />
          <span>
            Chatly<span className="brand-dot">.</span>
          </span>
        </div>
        {route === "#/signup" ? (
          <SignupForm onRegistering={setRegistering} />
        ) : (
          <LoginForm />
        )}
      </div>
    </main>
  )
}
