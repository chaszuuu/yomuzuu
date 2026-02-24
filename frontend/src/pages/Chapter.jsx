import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useParams, useNavigate, useLocation, Link } from "react-router-dom"
import api from "../api"
import Footer from "../components/Footer"

export default function Chapter() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const location     = useLocation()
  const chapterId    = parseInt(id)

  // FIX: derive mangaId once per location change so it's stable across renders
  const mangaId = useMemo(
    () => new URLSearchParams(location.search).get("mangaId"),
    [location.search]
  )

  const [pages, setPages]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [pageError, setPageError]       = useState(false)
  const [chapters, setChapters]         = useState([])
  const [mangaTitle, setMangaTitle]     = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const [navVisible, setNavVisible]     = useState(true)
  const [currentPage, setCurrentPage]   = useState(1)
  const dropdownRef  = useRef(null)
  const hideTimer    = useRef(null)
  const pageRefs     = useRef([])

  useEffect(() => {
    if (location.state?.chapters?.length) {
      const sorted = [...location.state.chapters].sort((a, b) => {
        const numA = parseFloat(a.title?.match(/[\d.]+/)?.[0] ?? 0)
        const numB = parseFloat(b.title?.match(/[\d.]+/)?.[0] ?? 0)
        return numA - numB
      })
      setChapters(sorted)
      setMangaTitle(location.state.mangaTitle || "")
    } else if (mangaId) {
      api.get(`/api/manga/${mangaId}`)
        .then(res => setMangaTitle(res.data?.title || ""))
      api.get(`/api/manga/${mangaId}/chapters`)
        .then(res => {
          const data = Array.isArray(res.data) ? res.data : []
          const sorted = [...data].sort((a, b) => {
            const numA = parseFloat(a.title?.match(/[\d.]+/)?.[0] ?? 0)
            const numB = parseFloat(b.title?.match(/[\d.]+/)?.[0] ?? 0)
            return numA - numB
          })
          setChapters(sorted)
        })
    }
  }, [mangaId])

  useEffect(() => {
    if (!chapterId) return
    setLoading(true)
    setPages([])
    setCurrentPage(1)
    // FIX: clear refs when pages change so stale refs don't accumulate
    pageRefs.current = []

    if (mangaId) {
      const currentChapter = chapters.find(ch => ch.id === chapterId)
      const toStore = currentChapter || { id: chapterId }
      localStorage.setItem(`lastChapter_${mangaId}`, JSON.stringify(toStore))
    }

    api.get(`/api/chapters/${chapterId}/pages${mangaId ? `?manga_id=${mangaId}` : ""}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data.filter(p => p.image_url) : []
        if (data.length === 0) setPageError(true)
        setPages(data)
        setLoading(false)
      })
      .catch(() => { setPageError(true); setLoading(false) })
  }, [chapterId])

  useEffect(() => {
    const show = () => {
      setNavVisible(true)
      clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setNavVisible(false), 3000)
    }
    window.addEventListener("mousemove", show)
    window.addEventListener("touchstart", show)
    show()
    return () => {
      window.removeEventListener("mousemove", show)
      window.removeEventListener("touchstart", show)
      clearTimeout(hideTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!pages.length) return
    const observers = []
    pageRefs.current.forEach((el, i) => {
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setCurrentPage(i + 1) },
        { rootMargin: "-40% 0px -40% 0px", threshold: 0 }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach(o => o.disconnect())
  }, [pages])

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const currentIndex   = chapters.findIndex(ch => ch.id === chapterId)
  const currentChapter = chapters[currentIndex]
  const prevChapter    = chapters[currentIndex - 1] ?? null
  const nextChapter    = chapters[currentIndex + 1] ?? null

  // FIX: removed replace:true so browser back button works correctly
  const goToChapter = useCallback((ch) => {
    setShowDropdown(false)
    navigate(
      `/chapter/${ch.id}?mangaId=${mangaId}`,
      { state: { chapters: location.state?.chapters || chapters, mangaTitle, mangaId } }
    )
  }, [chapters, mangaId, mangaTitle, location.state, navigate])

  const scrollToPage = useCallback((index) => {
    const el = pageRefs.current[index]
    if (el) el.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    if (currentChapter && mangaTitle) {
      document.title = `${mangaTitle} — ${currentChapter.title} — Yomuzuu`
    }
  }, [currentChapter, mangaTitle])

  useEffect(() => {
    if (loading || !pages.length) return
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        const next = currentPage
        if (next < pages.length) scrollToPage(next)
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        const prev = currentPage - 2
        if (prev >= 0) scrollToPage(prev)
      }
      if (e.key === "]" && nextChapter) goToChapter(nextChapter)
      if (e.key === "[" && prevChapter) goToChapter(prevChapter)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [loading, pages, currentPage, nextChapter, prevChapter, scrollToPage, goToChapter])

  if (loading) return (
    <div style={{ background: "#080808", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ width: 24, height: 24, border: "2px solid #ffffff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
      <p style={{ fontSize: 12, color: "#333333", letterSpacing: 2, textTransform: "uppercase" }}>Loading pages...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (pageError) return (
    <div style={{ background: "#080808", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "'Outfit', sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: "#1a1a1a", letterSpacing: 4 }}>No Pages</p>
      <p style={{ fontSize: 12, color: "#333333", letterSpacing: 2, textTransform: "uppercase" }}>Could not load this chapter</p>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        {mangaId && (
          <Link to={`/manga/${mangaId}`} style={{ fontSize: 11, color: "#555555", letterSpacing: 2, textTransform: "uppercase", textDecoration: "none", borderBottom: "1px solid #222222", paddingBottom: 2 }}
            onMouseEnter={e => e.currentTarget.style.color = "#ffffff"}
            onMouseLeave={e => e.currentTarget.style.color = "#555555"}
          >← Back to Manga</Link>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "white", fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .nav-bar { transition: transform 0.3s ease, opacity 0.3s ease; }
        .nav-bar.hidden { transform: translateY(-100%); opacity: 0; pointer-events: none; }
        .dropdown-item:hover { background: #1a1a1a !important; color: #ffffff !important; }
        .chapter-dropdown::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── TOP BAR ── */}
      <div
        className={`nav-bar${navVisible ? "" : " hidden"}`}
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          background: "rgba(5,5,5,0.95)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid #1a1a1a", height: 52,
          display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "0 32px", gap: 16,
        }}
      >
        {/* Left — back to manga */}
        <div style={{ display: "flex", alignItems: "center", overflow: "hidden" }}>
          <Link
            to={mangaId ? `/manga/${mangaId}` : "/"}
            style={{ textDecoration: "none", color: "#555555", fontSize: 15, fontWeight: 600, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, transition: "color 0.2s", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200, display: "flex", alignItems: "center", gap: 8 }}
            onMouseEnter={e => e.currentTarget.style.color = "#ffffff"}
            onMouseLeave={e => e.currentTarget.style.color = "#555555"}
          >
            <span>←</span>
            <span>{mangaTitle || "Back"}</span>
          </Link>
        </div>

        {/* Center — chapter dropdown */}
        <div ref={dropdownRef} style={{ position: "relative", width: 280 }}>
          <button
            onClick={() => setShowDropdown(v => !v)}
            style={{ background: "transparent", border: "1px solid #222222", color: "#cccccc", padding: "6px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, whiteSpace: "nowrap", transition: "border-color 0.2s", width: "100%" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#444444"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#222222"}
          >
            {currentChapter?.title || "Select Chapter"}
            <span style={{ color: "#444444", fontSize: 9, marginTop: 1 }}>▼</span>
          </button>

          {showDropdown && chapters.length > 0 && (
            <div className="chapter-dropdown" style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: "100%", maxHeight: 300, overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none", background: "rgba(8,8,8,0.98)", border: "1px solid #222222", zIndex: 200, animation: "fadeIn 0.15s ease" }}>
              {[...chapters].reverse().map(ch => (
                <button
                  key={ch.id}
                  className="dropdown-item"
                  onClick={() => goToChapter(ch)}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: ch.id === chapterId ? "#161616" : "transparent", border: "none", borderBottom: "1px solid #111111", color: ch.id === chapterId ? "#ffffff" : "#555555", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: ch.id === chapterId ? 700 : 400, cursor: "pointer", textAlign: "left", transition: "background 0.15s, color 0.15s" }}
                >
                  <span>{ch.title}</span>
                  {ch.id === chapterId && <span style={{ fontSize: 9, color: "#aaaaaa", letterSpacing: 1, flexShrink: 0 }}>NOW</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right — page counter */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#2a2a2a", letterSpacing: 1, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ color: "#888888", fontWeight: 700 }}>{currentPage}</span>
            {" / "}
            {pages.length}
          </span>
        </div>
      </div>

      {/* ── CLICK ZONES — always pointer cursor ── */}
      <div
        onClick={() => { const i = currentPage - 2; if (i >= 0) scrollToPage(i) }}
        style={{ position: "fixed", top: 52, left: 0, width: "50%", bottom: 48, zIndex: 10, cursor: "pointer" }}
      />
      <div
        onClick={() => { const i = currentPage; if (i < pages.length) scrollToPage(i) }}
        style={{ position: "fixed", top: 52, right: 0, width: "50%", bottom: 48, zIndex: 10, cursor: "pointer" }}
      />

      {/* ── PAGES ── */}
      <div style={{ paddingTop: 52, paddingBottom: 100, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {pages.map((p, i) => (
          <div
            key={p.page_number}
            ref={el => pageRefs.current[i] = el}
            style={{ width: "100%", maxWidth: 720, lineHeight: 0 }}
          >
            <img
              src={`${import.meta.env.VITE_API_URL}/proxy?url=${encodeURIComponent(p.image_url)}`}
              alt={`Page ${p.page_number}`}
              loading={i < 3 ? "eager" : "lazy"}
              style={{ width: "100%", display: "block" }}
            />
          </div>
        ))}
      </div>

      <Footer />

      {/* ── STICKY BOTTOM BAR ── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: "rgba(5,5,5,0.95)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderTop: "1px solid #1a1a1a", height: 48, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "0 24px", gap: 12 }}>
        {/* Prev chapter */}
        <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
          {prevChapter && (
            <span
              onClick={() => goToChapter(prevChapter)}
              style={{ color: "#555555", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8, transition: "color 0.2s", minWidth: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = "#ffffff"}
              onMouseLeave={e => e.currentTarget.style.color = "#555555"}
            >
              <span style={{ flexShrink: 0 }}>←</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prevChapter.title}</span>
            </span>
          )}
        </div>

        {/* Scroll to top */}
        <span
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{ color: "#333333", fontFamily: "'Outfit', sans-serif", fontSize: 10, letterSpacing: 2, cursor: "pointer", textTransform: "uppercase", transition: "color 0.2s", flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = "#ffffff"}
          onMouseLeave={e => e.currentTarget.style.color = "#333333"}
        >↑ Top</span>

        {/* Next chapter */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minWidth: 0 }}>
          {nextChapter && (
            <span
              onClick={() => goToChapter(nextChapter)}
              style={{ color: "#555555", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8, transition: "color 0.2s", minWidth: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = "#ffffff"}
              onMouseLeave={e => e.currentTarget.style.color = "#555555"}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextChapter.title}</span>
              <span style={{ flexShrink: 0 }}>→</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}