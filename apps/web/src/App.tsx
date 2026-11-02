
import { useAuth } from "./contexts/AuthContext"
import { logoutUser } from "./services/authService"
import { LoginForm } from "./components/login-form"

export function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <p>Checking authentication...</p>
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      {user ? (
        <>
          <p>Logged in as: {user.email}</p>
          <p>User ID: {user.uid}</p>

          <button onClick={() => void logoutUser()}>
            Logout
          </button>
        </>
      ) : (
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      )}
    </main>
  )
}
