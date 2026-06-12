import { useState, useEffect, useRef } from "react"
import toast from "react-hot-toast"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabaseClient"
import Modal from "./Modal"
import AvatarPicker from "./AvatarPicker"
import { AVATARS } from "../assets/avatars"

export default function ProfileModal({ isOpen, onClose }) {
  const { user, profile, refreshProfile } = useAuth()

  const [username, setUsername]             = useState("")
  const [selectedAvatar, setSelectedAvatar] = useState("")
  const [usernameError, setUsernameError]   = useState("")
  const [saving, setSaving]                 = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen && profile) {
      setUsername(profile.username || "")
      setSelectedAvatar(profile.avatar_id || AVATARS[0].id)
      setUsernameError("")
    }
  }, [isOpen, profile])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100)
  }, [isOpen])

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

  const hasChanges = profile
    ? username !== profile.username || selectedAvatar !== profile.avatar_id
    : false

  const handleSave = async () => {
    const err = validateUsername(username)
    if (err) { setUsernameError(err); return }
    if (!hasChanges) { onClose(); return }

    setSaving(true)
    setUsernameError("")

    if (username !== profile.username) {
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
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: username.toLowerCase(), avatar_id: selectedAvatar })
      .eq("user_id", user.id)

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
    toast.success("Profile updated", {
        iconTheme: { primary: "#22c55e", secondary: "#fff" },
      })
    onClose()
  }

  const currentAvatarSrc = AVATARS.find(a => a.id === selectedAvatar)?.src

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={560} closable>
      <div style={{ padding: "36px 32px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          {currentAvatarSrc && (
            <img
              src={currentAvatarSrc}
              alt="preview"
              style={{ width: 52, height: 52, borderRadius: "50%", border: "2px solid #e8b84b", objectFit: "cover", flexShrink: 0, transition: "all 0.2s" }}
            />
          )}
          <div>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 3, color: "#dddddd", margin: 0 }}>EDIT PROFILE</p>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "#444", margin: "2px 0 0" }}>{user?.email}</p>
          </div>
        </div>

        {/* Avatar */}
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

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", padding: "11px 24px", background: "transparent", color: "#444", border: "1px solid #222", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#888"; e.currentTarget.style.borderColor = "#333" }}
            onMouseLeave={e => { e.currentTarget.style.color = "#444"; e.currentTarget.style.borderColor = "#222" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !username || !!usernameError || !hasChanges}
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: (saving || !hasChanges) ? "not-allowed" : "pointer", padding: "11px 24px", background: "#e8b84b", color: "#080808", border: "none", opacity: (saving || !username || !!usernameError || !hasChanges) ? 0.4 : 1, transition: "all 0.2s" }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  )
}