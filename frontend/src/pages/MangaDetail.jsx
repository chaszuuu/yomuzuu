import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import api from "../api"
import { useBookmarks } from "../hooks/useBookmarks"
import { MangaDetailHeroSkeleton, MangaDetailBodySkeleton } from "../components/Skeletons"

const CHAPTERS_PER_PAGE = 25

function getPaginationRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total]
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total]
  return [1, "...", current - 1, current, current + 1, "...", total]
}

export default function MangaDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { isBookmarked, toggleBookmark } = useBookmarks()

  const [manga, setManga]                     = useState(null)
  const [notFound, setNotFound]               = useState(false)
  const [chapters, setChapters]               = useState([])
  const [loadingManga, setLoadingManga]       = useState(true)
  const [loadingChapters, setLoadingChapters] = useState(true)
  const [chapterPage, setChapterPage]         = useState(1)
  const [perPage, setPerPage]                 = useState(CHAPTERS_PER_PAGE)

  useEffect(() => {
    setManga(null); setNotFound(false); setChapters([])
    setLoadingManga(true); setLoadingChapters(true)

    api.get(`/api/manga/${id}`)
      .then(res => { setManga(res.data); setLoadingManga(false) })
      .catch(() => { setNotFound(true); setLoadingManga(false) })

    api.get(`/api/manga/${id}/chapters`)
      .then(res => {
        setChapters(Array.isArray(res.data) ? res.data : [])
        setLoadingChapters(false)
      })
      .catch(() => setLoadingChapters(false))
  }, [id])

  useEffect(() => {
    if (manga) document.title = `${manga.title} — Yomuzuu`
    return () => { document.title = "Yomuzuu — Read Manga Online" }
  }, [manga])

  const lastChapter = (() => {
    try { return JSON.parse(localStorage.getItem(`lastChapter_${id}`)) } catch { return null }
  })()

  const reversedChapters  = [...chapters].reverse()
  const totalChapterPages = Math.ceil(reversedChapters.length / perPage)
  const paginatedChapters = reversedChapters.slice((chapterPage - 1) * perPage, chapterPage * perPage)
  const paginationRange   = getPaginationRange(chapterPage, totalChapterPages)

  if (notFound) return (
    <div className="bg-[#080808] min-h-screen flex flex-col items-center justify-center gap-4 font-['Outfit',sans-serif]">
      <p className="font-['Bebas_Neue',sans-serif] text-[64px] text-[#1a1a1a] tracking-[4px]">404</p>
      <p className="text-[13px] text-[#333333] tracking-[2px] uppercase">Manga not found</p>
      <Link to="/" className="text-[11px] text-[#555555] tracking-[2px] uppercase no-underline border-b border-[#222222] pb-0.5 hover:text-white transition-colors">
        Back to Home
      </Link>
    </div>
  )

  return (
    <div className="bg-[#080808] min-h-screen text-white font-['Outfit',sans-serif]">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── TOPBAR ── */}
      <div className="bg-[#050505] border-b border-[#222222] px-4 sm:px-10 py-3 relative z-50 flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => navigate(-1)}
          className="bg-[#111111] border border-[#222222] text-[#555555] px-3 sm:px-5 py-2 text-sm font-semibold cursor-pointer tracking-wide transition-all hover:border-white hover:text-white shrink-0 font-['Outfit',sans-serif]"
        >← Back</button>
        <div className="flex items-center gap-1.5 text-[11px] text-[#333333] min-w-0">
          <Link to="/" className="text-[#555555] no-underline hover:text-white transition-colors shrink-0">Home</Link>
          <span className="shrink-0">/</span>
          <Link to="/browse" className="text-[#555555] no-underline hover:text-white transition-colors shrink-0">Browse</Link>
          <span className="shrink-0">/</span>
          <span className="text-[#aaaaaa] truncate">{manga?.title ?? "..."}</span>
        </div>
      </div>

      {/* ── HERO ── */}
      {loadingManga ? <MangaDetailHeroSkeleton /> : (
        <div className="relative w-full overflow-hidden" style={{ minHeight: "clamp(260px, 50vw, 420px)" }}>
          {/* Blurred bg */}
          <img
            src={`${import.meta.env.VITE_API_URL}/proxy?url=${encodeURIComponent(manga.cover)}`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-[0.18]"
            style={{ filter: "blur(6px)", transform: "scale(1.05)" }}
          />
          {/* Bottom fade */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(8,8,8,0.1) 0%, rgba(8,8,8,0.75) 60%, #080808 100%)" }} />
          {/* Left fade on desktop */}
          <div className="absolute inset-0 hidden sm:block" style={{ background: "linear-gradient(to right, rgba(8,8,8,0.5) 0%, transparent 55%)" }} />

          {/* Cover + info row, bottom-anchored */}
          <div
            className="relative z-10 max-w-5xl mx-auto px-4 sm:px-12 flex flex-row items-end gap-4 sm:gap-8 pb-6 sm:pb-10"
            style={{ minHeight: "clamp(260px, 50vw, 420px)" }}
          >
            <img
              src={`${import.meta.env.VITE_API_URL}/proxy?url=${encodeURIComponent(manga.cover)}`}
              alt={manga.title}
              className="shrink-0 border border-[#2a2a2a] object-cover"
              style={{
                width: "clamp(75px, 15vw, 200px)",
                height: "clamp(108px, 22vw, 290px)",
                boxShadow: "0 16px 60px rgba(0,0,0,0.9)",
                opacity: 0,
                transition: "opacity 0.35s ease",
              }}
              onLoad={e => { e.currentTarget.style.opacity = 1 }}
            />

            <div className="flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2 pb-0.5">
              <p className="text-[10px] text-[#666666] font-bold tracking-[3px] uppercase">
                {manga.genres?.split(",")[0]?.trim()}
              </p>
              <h1
                className="font-['Bebas_Neue',sans-serif] leading-none tracking-[2px] text-white"
                style={{ fontSize: "clamp(24px, 4.5vw, 56px)" }}
              >
                {manga.title}
              </h1>

              {/* Stats */}
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <span className="text-[12px] text-[#dddddd] font-bold">★ {manga.score}</span>
                <span className="text-[11px] text-[#555555]">{chapters.length} ch.</span>
                <span className="text-[11px] text-[#555555]">{manga.status || "Publishing"}</span>
              </div>

              {/* Genre tags — sm+ only */}
              <div className="hidden sm:flex flex-wrap gap-1.5">
                {manga.genres?.split(",").map(g => (
                  <span key={g} className="text-[10px] text-[#555555] border border-[#222222] px-2.5 py-0.5 tracking-wide uppercase">
                    {g.trim()}
                  </span>
                ))}
              </div>

              {/* Buttons */}
              <div className="flex gap-1.5 sm:gap-2 flex-wrap mt-0.5">
                {chapters.length > 0 && (
                  <Link
                    to={`/chapter/${chapters[0].id}?mangaId=${id}`}
                    state={{ chapters, mangaTitle: manga.title, mangaId: id }}
                    replace
                    className="bg-white text-[#080808] px-3 sm:px-5 py-2 text-[10px] sm:text-[11px] font-bold tracking-[1.5px] no-underline uppercase shrink-0"
                  >
                    Start Reading
                  </Link>
                )}
                {lastChapter && (
                  <Link
                    to={`/chapter/${lastChapter.id}?mangaId=${id}`}
                    state={{ chapters, mangaTitle: manga.title, mangaId: id }}
                    replace
                    className="bg-transparent text-[#dddddd] border border-[#2a2a2a] px-3 sm:px-5 py-2 text-[10px] sm:text-[11px] font-bold tracking-[1.5px] no-underline uppercase shrink-0"
                  >
                    Continue
                  </Link>
                )}
                <button
                  onClick={() => toggleBookmark(manga)}
                  className="px-3 sm:px-5 py-2 text-[10px] sm:text-[11px] font-bold tracking-[1.5px] uppercase cursor-pointer font-['Outfit',sans-serif] transition-all duration-200 shrink-0"
                  style={{
                    background: isBookmarked(manga.id) ? "#e8b84b" : "transparent",
                    color: isBookmarked(manga.id) ? "#080808" : "#555555",
                    border: `1px solid ${isBookmarked(manga.id) ? "#e8b84b" : "#2a2a2a"}`,
                  }}
                >
                  {isBookmarked(manga.id) ? "★ Saved" : "☆ Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BODY ── */}
      {loadingManga || loadingChapters ? (
        <MangaDetailBodySkeleton chapterCount={10} />
      ) : (
        <div className="max-w-5xl mx-auto px-4 sm:px-12 py-6 sm:py-10 flex flex-col md:flex-row gap-6 md:gap-10">

          {/* Synopsis */}
          <div className="md:w-[200px] shrink-0">
            <p className="text-[10px] text-[#444444] font-bold tracking-[2px] uppercase mb-3">Synopsis</p>
            <p className="text-[13px] text-[#777777] leading-[1.8] text-justify">{manga.description}</p>
          </div>

          {/* Chapters */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <h2 className="font-['Bebas_Neue',sans-serif] text-[18px] tracking-[3px] text-[#dddddd]">Chapters</h2>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#333333] mr-1">Per page</span>
                {[25, 50, 100].map(n => (
                  <button key={n}
                    onClick={() => { setPerPage(n); setChapterPage(1) }}
                    className="px-2.5 py-1 text-[11px] font-semibold cursor-pointer font-['Outfit',sans-serif] transition-colors"
                    style={{
                      border: `1px solid ${perPage === n ? "#ffffff" : "#222222"}`,
                      background: perPage === n ? "#ffffff18" : "transparent",
                      color: perPage === n ? "#ffffff" : "#444444",
                    }}
                  >{n}</button>
                ))}
              </div>
            </div>

            <div className="flex flex-col border border-[#1a1a1a]">
              {paginatedChapters.map((ch, i) => (
                <Link
                  key={ch.id}
                  to={`/chapter/${ch.id}?mangaId=${id}`}
                  state={{ chapters, mangaTitle: manga.title, mangaId: id }}
                  replace
                  className="no-underline"
                >
                  <div
                    className="grid items-center px-4 py-3 transition-colors hover:bg-[#111111] cursor-pointer"
                    style={{
                      gridTemplateColumns: "1fr auto",
                      borderBottom: i < paginatedChapters.length - 1 ? "1px solid #111111" : "none",
                    }}
                  >
                    <span className="text-[13px] text-[#cccccc] font-medium pr-3 truncate">{ch.title}</span>
                    <span className="text-[11px] text-[#333333] shrink-0">{ch.date}</span>
                  </div>
                </Link>
              ))}
            </div>

            {totalChapterPages > 1 && (
              <div className="flex gap-1 mt-5 items-center flex-wrap">
                <button
                  onClick={() => setChapterPage(p => Math.max(1, p - 1))}
                  disabled={chapterPage === 1}
                  className="px-3 py-1.5 border border-[#222222] bg-transparent font-['Outfit',sans-serif] text-[11px] font-bold cursor-pointer"
                  style={{ color: chapterPage === 1 ? "#222222" : "#dddddd" }}
                >←</button>

                {paginationRange.map((p, i) => p === "..." ? (
                  <span key={`e-${i}`} className="px-2 py-1.5 text-[#333333] text-[11px]">···</span>
                ) : (
                  <button key={p}
                    onClick={() => setChapterPage(p)}
                    className="font-['Outfit',sans-serif] text-[11px] font-bold cursor-pointer"
                    style={{
                      padding: "6px 10px",
                      minWidth: 32,
                      border: `1px solid ${chapterPage === p ? "#ffffff" : "#222222"}`,
                      background: chapterPage === p ? "#ffffff18" : "transparent",
                      color: chapterPage === p ? "#ffffff" : "#444444",
                    }}
                  >{p}</button>
                ))}

                <button
                  onClick={() => setChapterPage(p => Math.min(totalChapterPages, p + 1))}
                  disabled={chapterPage === totalChapterPages}
                  className="px-3 py-1.5 border border-[#222222] bg-transparent font-['Outfit',sans-serif] text-[11px] font-bold cursor-pointer"
                  style={{ color: chapterPage === totalChapterPages ? "#222222" : "#dddddd" }}
                >→</button>

                <span className="text-[11px] text-[#333333] ml-2">
                  {(chapterPage - 1) * perPage + 1}–{Math.min(chapterPage * perPage, reversedChapters.length)} of {reversedChapters.length}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}