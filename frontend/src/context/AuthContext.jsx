import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import toast from "react-hot-toast"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]                       = useState(null)
  const [session, setSession]                 = useState(null)
  const [profile, setProfile]                 = useState(null)
  const [profileLoading, setProfileLoading]   = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [loading, setLoading]                 = useState(true)

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("username, avatar_id")
      .eq("user_id", userId)
      .single()

    if (!error && data) {
      setProfile(data)
      setNeedsOnboarding(false)
      return data
    } else {
      setProfile(null)
      setNeedsOnboarding(true)
      return null
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).then(() => setProfileLoading(false))
      } else {
        setProfileLoading(false)
      }
      setLoading(false)
    })

    // onAuthStateChange only handles session state — no toast logic here
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUser = session?.user ?? null
      setSession(session)
      setUser(newUser)

      if (newUser) {
        const profileData = await fetchProfile(newUser.id)
        setProfileLoading(false)

        // Only show toast on onboarding completion (new user, no existing profile)
        if (event === "SIGNED_IN" && !profileData) {
          // new user — onboarding will handle their welcome
        }
      } else {
        setProfile(null)
        setNeedsOnboarding(false)
        setProfileLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    // Set a flag before redirecting — this is the only place we know
    // with 100% certainty a login is being intentionally initiated
    sessionStorage.setItem("auth_signing_in", "true")
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    })
  }

  // Called once on app load — checks if we just came back from an OAuth redirect
  useEffect(() => {
    const justSignedIn = sessionStorage.getItem("auth_signing_in") === "true"
    if (!justSignedIn) return

    sessionStorage.removeItem("auth_signing_in")

    // Wait for session to be ready then show the toast
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return
      const profileData = await fetchProfile(session.user.id)
      setProfileLoading(false)
      if (profileData) {
        toast.success(`Hey ${profileData.username}, good to see you!`, {
          iconTheme: { primary: "#22c55e", secondary: "#fff" },
        })
      }
    })
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setNeedsOnboarding(false)
    setProfileLoading(false)
    sessionStorage.removeItem("auth_signing_in")
    toast.success("You've been signed out. See you soon!", {
      iconTheme: { primary: "#22c55e", secondary: "#fff" },
    })
  }

  const refreshProfile = async (userId) => {
    const data = await fetchProfile(userId)
    setProfileLoading(false)
    return data
  }

  return (
    <AuthContext.Provider value={{
      user, session, profile, profileLoading,
      needsOnboarding, setNeedsOnboarding,
      loading, signInWithGoogle, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}