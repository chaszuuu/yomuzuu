import { useState, useEffect, useRef } from "react"
import toast from "react-hot-toast"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabaseClient"
import Modal from "./Modal"
import AvatarPicker from "./AvatarPicker"
import { AVATARS } from "../assets/avatars"

export default function LoginModal({ isOpen, onClose }) {
  const { user, signInWithGoogle, signOut, needsOnboarding, refreshProfile } = useAuth()

  const [step, setStep]                     = useState("login")
  const [username, setUsername]             = useState("")
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].id)
  const [usernameError, setUsernameError]   = useState("")
  const [saving, setSaving]                 = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    if (needsOnboarding && user) {
      setStep("onboarding")
      const googleName = user.user_metadata?.name || ""
      const cleaned = googleName.replace(/\s+/g, "_").toLowerCase().slice(0, 20)
      setUsername(cleaned)
    } else if (!user) {
      setStep("login")
    }
  }, [needsOnboarding, user, isOpen])

  useEffect(() => {
    if (step === "onboarding") setTimeout(() => inputRef.current?.focus(), 100)
  }, [step])

  const validateUsername = (val) => {
    if (!val) return "Username is required"
    if (val.length < 3) return "At least 3 characters"
    if (val.length > 20) return "Max 20 characters"
    if (!/^[a-zA-Z0-9_]+$/.test(val)) return "Only letters, numbers, underscores"
    return ""
  }

  const handleUsernameChange = (e) => {
    const val = e.target.value.replace(/\s/g, "_")
    setUsername(val)
    if (usernameError) setUsernameError(validateUsername(val))
  }

  const handleSaveProfile = async () => {
    const err = validateUsername(username)
    if (err) { setUsernameError(err); return }

    setSaving(true)
    setUsernameError("")

    const { data: existing } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("username", username.toLowerCase())
      .single()

    if (existing) {
      setUsernameError("Username already taken")
      setSaving(false)
      return
    }

    const { error } = await supabase.from("profiles").insert({
      user_id: user.id,
      username: username.toLowerCase(),
      avatar_id: selectedAvatar,
    })

    if (error) {
      setUsernameError(
        error.message.includes("profiles_username_key")
          ? "Username already taken"
          : "Something went wrong, try again"
      )
      setSaving(false)
      return
    }

    await refreshProfile(user.id)
    setSaving(false)
    toast.success(`Profile created. Welcome, ${username}! 🎉`)
    onClose()
  }

  const handleCancelOnboarding = async () => {
    await signOut()
    setStep("login")
    setUsername("")
    setSelectedAvatar(AVATARS[0].id)
    setUsernameError("")
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={step === "onboarding" ? 560 : 380}
      closable={step !== "onboarding"}
    >
      {/* LOGIN */}
      {step === "login" && (
        <div style={{ padding: "40px 36px" }}>
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, color: "#dddddd", margin: "0 0 6px" }}>SIGN IN</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#444", letterSpacing: 1, margin: "0 0 32px" }}>
            Sync bookmarks and reading progress across devices
          </p>
          <button
            onClick={signInWithGoogle}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, background: "#111", border: "1px solid #222", color: "#ccc", padding: "13px 20px", cursor: "pointer", transition: "all 0.2s", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#444"; e.currentTarget.style.color = "#fff" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#222"; e.currentTarget.style.color = "#ccc" }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4c-7.7 0-14.3 4.3-17.7 10.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36.4 24 36.4c-5.2 0-9.6-3.5-11.2-8.2l-6.6 5C9.8 39.8 16.4 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6.2 5.2C41.1 35.2 44 30 44 24c0-1.3-.1-2.7-.4-4z"/>
            </svg>
            Continue with Google
          </button>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "#2a2a2a", textAlign: "center", marginTop: 20, letterSpacing: 0.5 }}>
            Guest bookmarks will be merged into your account on first login
          </p>
        </div>
      )}

      {/* ONBOARDING */}
      {step === "onboarding" && (
        <div style={{ padding: "36px 32px" }}>
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 3, color: "#dddddd", margin: "0 0 4px" }}>SET UP YOUR PROFILE</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#444", letterSpacing: 0.5, margin: "0 0 24px" }}>
            Choose an avatar and pick a username
          </p>

          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "#555", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Avatar</p>
          <div style={{ marginBottom: 28 }}>
            <AvatarPicker selected={selectedAvatar} onSelect={setSelectedAvatar} />
          </div>

          {/* Username inline */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "#555", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 8 }}>
              Username
            </label>
            <input
              ref={inputRef}
              type="text"
              value={username}
              onChange={handleUsernameChange}
              onBlur={() => setUsernameError(validateUsername(username))}
              placeholder="your_username"
              maxLength={20}
              style={{ width: "100%", background: "#0d0d0d", border: `1px solid ${usernameError ? "#cc4444" : "#222"}`, color: "#fff", padding: "10px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
              onFocus={e => e.target.style.borderColor = usernameError ? "#cc4444" : "#444"}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: usernameError ? "#cc4444" : "#333" }}>
                {usernameError || "Letters, numbers, underscores only"}
              </span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: username.length > 16 ? "#e8b84b" : "#333" }}>
                {username.length}/20
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={handleCancelOnboarding}
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", padding: "11px 24px", background: "transparent", color: "#444", border: "1px solid #222", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#888"; e.currentTarget.style.borderColor = "#333" }}
              onMouseLeave={e => { e.currentTarget.style.color = "#444"; e.currentTarget.style.borderColor = "#222" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={saving || !username || !!usernameError}
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: saving ? "not-allowed" : "pointer", padding: "11px 24px", background: "#e8b84b", color: "#080808", border: "none", opacity: (saving || !username || !!usernameError) ? 0.5 : 1, transition: "all 0.2s" }}
            >
              {saving ? "Saving..." : "Start Reading →"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}