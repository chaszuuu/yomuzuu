import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import LoginModal from "./LoginModal"

const CURRENT_VERSION = "1.1.0"
const STORAGE_KEY = "yomu_last_seen_version"

const FEATURES = [
  {
    index: "01",
    name: "Sign in / sign up",
    desc: "Free account — email or OAuth, takes seconds.",
  },
  {
    index: "02",
    name: "Synced bookmarks",
    desc: "Your saved manga lives in the cloud, not just your browser.",
  },
  {
    index: "03",
    name: "Read progress sync",
    desc: "Resume exactly where you left off on any device.",
  },
]

export default function ChangelogModal() {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (seen === CURRENT_VERSION) return
    const t = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(t)
  }, [])

  const dismiss = () => {
    setExiting(true)
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
    setTimeout(() => setVisible(false), 220)
  }

  const tryItOut = () => {
    dismiss()
    setTimeout(() => setLoginOpen(true), 240)
  }

  if (!visible && !loginOpen) return null

  return (
    <>
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />

      {visible && (
        <div
          onClick={dismiss}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 999, padding: 16,
            fontFamily: "'Outfit', sans-serif",
            opacity: exiting ? 0 : 1,
            transition: "opacity 0.22s ease",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#080808",
              border: "1px solid #1e1e1e",
              width: "100%", maxWidth: 420,
              opacity: exiting ? 0 : 1,
              transform: exiting ? "translateY(8px) scale(0.98)" : "translateY(0) scale(1)",
              transition: "opacity 0.22s ease, transform 0.22s cubic-bezier(.16,1,.3,1)",
              animation: "yomu-rise 0.3s cubic-bezier(.16,1,.3,1)",
            }}
          >
            <style>{`
              @keyframes yomu-rise {
                from { opacity: 0; transform: translateY(16px) scale(0.98); }
                to   { opacity: 1; transform: translateY(0)   scale(1);    }
              }
            `}</style>

            <div style={{ padding: "18px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: "#2a2a2a", textTransform: "uppercase" }}>
                Release — v{CURRENT_VERSION}
              </span>
              <button
                onClick={dismiss}
                aria-label="Close"
                style={{ background: "none", border: "none", color: "#2a2a2a", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0, transition: "color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                onMouseLeave={e => e.currentTarget.style.color = "#2a2a2a"}
              >✕</button>
            </div>

            <div style={{ padding: "16px 22px 20px", borderBottom: "1px solid #141414" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: "#22c55e", textTransform: "uppercase", marginBottom: 8 }}>
                What's new
              </p>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, letterSpacing: 3, color: "#fff", lineHeight: 0.95, marginBottom: 10 }}>
                Accounts<br />are here
              </h2>
              <p style={{ fontSize: 12, color: "#3a3a3a", lineHeight: 1.7, maxWidth: 320 }}>
                Sign in once, pick up anywhere. Your progress and bookmarks now follow you across every device.
              </p>
            </div>

            <div style={{ padding: "0 22px" }}>
              {FEATURES.map((f, i) => (
                <div
                  key={f.index}
                  style={{
                    display: "flex", alignItems: "baseline", gap: 14,
                    padding: "13px 0",
                    borderBottom: i < FEATURES.length - 1 ? "1px solid #111" : "none",
                  }}
                >
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: "#1e1e1e", letterSpacing: 1, minWidth: 18 }}>
                    {f.index}
                  </span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#aaa", letterSpacing: 0.3, margin: 0 }}>
                      {f.name}
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#22c55e", border: "1px solid #22c55e33", padding: "2px 6px", marginLeft: 8, verticalAlign: "middle" }}>
                        New
                      </span>
                    </p>
                    <p style={{ fontSize: 11, color: "#2e2e2e", marginTop: 3, lineHeight: 1.5 }}>
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: "16px 22px", borderTop: "1px solid #141414", display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={tryItOut}
                style={{ background: "#fff", color: "#080808", border: "none", padding: "11px 0", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2.5, cursor: "pointer", flex: 1, textTransform: "uppercase", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#22c55e"}
                onMouseLeave={e => e.currentTarget.style.background = "#fff"}
              >
                Try it out
              </button>
              <button
                onClick={dismiss}
                style={{ background: "none", border: "none", color: "#252525", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", padding: "11px 14px", transition: "color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#555"}
                onMouseLeave={e => e.currentTarget.style.color = "#252525"}
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}