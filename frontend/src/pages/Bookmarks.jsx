import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import Footer from "../components/Footer"
import { useBookmarks } from "../hooks/useBookmarks"
import { TopbarSkeleton, PageTitleSkeleton, MangaGridSkeleton } from "../components/Skeletons"

export default function Bookmarks() {
  const { bookmarks, toggleBookmark } = useBookmarks()
  const [loading, setLoading] = useState(true)

  // Simulate a brief mount delay so skeletons show during hydration
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    document.title = "Bookmarks — Yomuzuu"
    return () => { document.title = "Yomuzuu — Read Manga Online" }
  }, [])

  const blurUp = (base = {}) => ({
    style: { opacity: 0, transition: "opacity 0.35s ease", ...base },
    onLoad: e => { e.currentTarget.style.opacity = 1 },
  })

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "white", fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        .bookmark-card .overlay { opacity: 0; transition: opacity 0.2s ease; }
        .bookmark-card:hover .overlay { opacity: 1; }
        .bookmark-card .cover { transition: transform 0.3s ease; }
        .bookmark-card:hover .cover { transform: scale(1.04); }
        .remove-btn:hover { background: rgba(220,60,60,0.9) !important; color: #ffffff !important; }
      `}</style>

      {/* TOPBAR */}
      {loading ? <TopbarSkeleton showCount /> : (
        <div style={{ background: "#050505", borderBottom: "1px solid #222222", padding: "12px 40px", position: "relative", zIndex: 50, display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            to="/"
            style={{ background: "#111111", border: "1px solid #222222", color: "#555555", padding: "11px 18px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: 1, textDecoration: "none", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#ffffff"; e.currentTarget.style.color = "#ffffff" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#222222"; e.currentTarget.style.color = "#555555" }}
          >← Back</Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#333333" }}>
            <Link to="/" style={{ color: "#555555", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#ffffff"}
              onMouseLeave={e => e.currentTarget.style.color = "#555555"}>Home</Link>
            <span>/</span>
            <span style={{ color: "#aaaaaa" }}>Bookmarks</span>
          </div>
          {bookmarks.length > 0 && (
            <span style={{ fontSize: 11, color: "#333333", marginLeft: "auto", letterSpacing: 2, textTransform: "uppercase" }}>
              {bookmarks.length} {bookmarks.length === 1 ? "title" : "titles"}
            </span>
          )}
        </div>
      )}

      {/* PAGE TITLE */}
      {loading ? <PageTitleSkeleton /> : (
        <div style={{ padding: "28px 40px 24px", borderBottom: "1px solid #111111" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 28, height: 2, background: "#ffffff" }} />
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 3, color: "#aaaaaa" }}>YOUR LIBRARY</span>
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, letterSpacing: 3, color: "#ffffff", lineHeight: 1 }}>
            Bookmarks
          </h1>
        </div>
      )}

      {/* CONTENT */}
      <div style={{ padding: "40px 40px 60px" }}>
        {loading ? (
          <MangaGridSkeleton count={12} cols="browse" />
        ) : bookmarks.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, gap: 16 }}>
            <span style={{ fontSize: 40, opacity: 0.15 }}>☆</span>
            <p style={{ fontSize: 13, color: "#333333", letterSpacing: 2, textTransform: "uppercase" }}>No bookmarks yet</p>
            <Link
              to="/"
              style={{ fontSize: 11, color: "#555555", letterSpacing: 2, textTransform: "uppercase", textDecoration: "none", borderBottom: "1px solid #222222", paddingBottom: 2, transition: "color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#ffffff"}
              onMouseLeave={e => e.currentTarget.style.color = "#555555"}
            >Browse Manga →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {bookmarks.map(m => (
              <div key={m.id} className="bookmark-card" style={{ position: "relative", minWidth: 0 }}>
                <div style={{ width: "100%", paddingBottom: "146%", position: "relative", border: "1px solid #1a1a1a", overflow: "hidden" }}>
                  <img
                    src={`${import.meta.env.VITE_API_URL}/proxy?url=${encodeURIComponent(m.cover)}`}
                    alt={m.title}
                    loading="lazy"
                    className="cover"
                    {...blurUp({ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" })}
                  />
                  <div className="overlay" style={{ position: "absolute", inset: 0, background: "rgba(8,8,8,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 12 }}>
                    <Link
                      to={`/manga/${m.id}`}
                      style={{ width: "100%", background: "#ffffff", color: "#080808", padding: "8px 0", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", textDecoration: "none", textAlign: "center", transition: "opacity 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                    >View</Link>
                    <button
                      onClick={() => toggleBookmark(m)}
                      className="remove-btn"
                      style={{ width: "100%", background: "transparent", border: "1px solid #333333", color: "#555555", padding: "8px 0", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", fontFamily: "'Outfit', sans-serif", transition: "background 0.2s, color 0.2s" }}
                    >Remove</button>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: "#cccccc", marginTop: 6, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.title}
                </p>
                {/* FIX: guard against undefined score */}
                {m.score != null && (
                  <p style={{ fontSize: 10, color: "#e8b84b", marginTop: 1 }}>★ {m.score}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}