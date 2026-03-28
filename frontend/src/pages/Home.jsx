import { useEffect, useState, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import api from "../api"
import Footer from "../components/Footer"
import { useBookmarks } from "../hooks/useBookmarks"
import {
  HeroSkeleton,
  HeroLabelSkeleton,
  SectionHeaderSkeleton,
  MangaGridSkeleton,
  SearchBarSkeleton,
} from "../components/Skeletons"

const GENRES = ["All", "Action", "Romance", "Fantasy", "Horror", "Slice of Life", "Shounen", "Seinen", "Mystery", "Award Winning"]
const HERO_COUNT = 5
const PER_PAGE = 12

function ellipsisPages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = []
  pages.push(1)
  if (current > 3) pages.push("...")
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2) pages.push("...")
  pages.push(total)
  return pages
}

function MangaRow({ items, loading, skeletonCount = 8 }) {
  const blurUp = (baseStyle = {}) => ({
    style: { opacity: 0, transition: "opacity 0.35s ease", ...baseStyle },
    onLoad: e => { e.currentTarget.style.opacity = 1 },
  })

  if (loading) return <MangaGridSkeleton count={skeletonCount} cols="home-lg" />

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 sm:gap-3">
      {items.map((m, i) => (
        <Link to={`/manga/${m.id}`} key={m.id} style={{ textDecoration: "none", minWidth: 0 }}>
          <div>
            <div
              style={{ width: "100%", paddingBottom: "146%", position: "relative", border: "1px solid #1a1a1a", overflow: "hidden" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#ffffff"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#1a1a1a"}
            >
              <img src={m.cover} alt={m.title} loading="lazy" {...blurUp({ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" })} />
              <div style={{ position: "absolute", top: 6, left: 6, background: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "#ffffff", color: "#080808", fontSize: 8, fontWeight: 700, padding: "2px 6px", letterSpacing: 1 }}>#{i + 1}</div>
            </div>
            <p style={{ fontSize: 11, color: "#cccccc", marginTop: 6, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</p>
            <p style={{ fontSize: 10, color: "#333333", marginTop: 1 }}>{m.genres?.split(",")[0]}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}

export default function Home() {
  const [allManga, setAllManga]               = useState([])
  const [loading, setLoading]                 = useState(true)
  const [search, setSearch]                   = useState("")
  const [searchInput, setSearchInput]         = useState("")
  const [genre, setGenre]                     = useState("All")
  const [heroIndex, setHeroIndex]             = useState(0)
  const [results, setResults]                 = useState([])
  const [page, setPage]                       = useState(1)
  const [showDropdown, setShowDropdown]       = useState(false)
  const [dropdownResults, setDropdownResults] = useState([])
  const [dropdownLoading, setDropdownLoading] = useState(false)
  const searchRef                             = useRef(null)
  const { isBookmarked, toggleBookmark }      = useBookmarks()
  const navigate                              = useNavigate()

  useEffect(() => { document.title = "Yomuzuu — Read Manga Online" }, [])

  useEffect(() => {
    api.get("/api/manga")
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : []
        setAllManga(data)
        setResults(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setHeroIndex(i => (i + 1) % HERO_COUNT), 4000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!search) {
      setShowDropdown(false)
      setDropdownResults([])
      setResults(allManga)
      return
    }
    setShowDropdown(true)
    setDropdownLoading(true)
    const timeout = setTimeout(() => {
      api.get(`/api/search?q=${search}`)
        .then(res => {
          const data = Array.isArray(res.data) ? res.data : []
          setDropdownResults(data.slice(0, 6))
          setResults(data)
          setDropdownLoading(false)
          setPage(1)
        })
        .catch(() => setDropdownLoading(false))
    }, 500)
    return () => clearTimeout(timeout)
  }, [search, allManga])

  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const topRatedAll = [...allManga].sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0))
  const heroManga   = topRatedAll[heroIndex] ?? null

  const recentlyAdded = (genre === "All"
    ? [...allManga]
    : allManga.filter(m => m.genres?.includes(genre))
  ).slice(-8).reverse()

  // Separate top rated by type
  const topRatedManga   = topRatedAll.filter(m => m.type === "manga").slice(0, 8)
  const topRatedManhwa  = topRatedAll.filter(m => m.type === "manhwa" || m.type === "manhua").slice(0, 8)

  const byGenre    = genre === "All" ? (search ? results : allManga) : allManga.filter(m => m.genres?.includes(genre))
  const totalPages = Math.ceil(byGenre.length / PER_PAGE)
  const paginated  = byGenre.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  // Preload hero cover images
  useEffect(() => {
    if (!topRatedAll.length) return
    topRatedAll.slice(0, HERO_COUNT).forEach(manga => {
      if (!manga?.cover) return
      const link = document.createElement("link")
      link.rel = "preload"; link.as = "image"
      link.href = manga.cover
      document.head.appendChild(link)
    })
  }, [allManga])

  const blurUp = (baseStyle = {}) => ({
    style: { opacity: 0, transition: "opacity 0.35s ease", ...baseStyle },
    onLoad: e => { e.currentTarget.style.opacity = 1 },
  })

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const heroDesc = heroManga?.description ?? ""

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "white", fontFamily: "'Outfit', sans-serif", overflowX: "hidden" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── SEARCH ── */}
      {loading ? <SearchBarSkeleton /> : (
        <form onSubmit={handleSearch} className="px-4 sm:px-10 py-3 bg-[#050505] border-b border-[#1a1a1a] z-50" ref={searchRef}>
          <div className="relative">
            <div className="flex">
              <input
                type="text"
                placeholder="Search manga..."
                value={searchInput}
                onChange={e => { setSearchInput(e.target.value); setSearch(e.target.value) }}
                onFocus={() => search && setShowDropdown(true)}
                className="flex-1 bg-[#111111] border border-[#222222] border-r-0 px-3 sm:px-5 py-2.5 text-white font-['Outfit',sans-serif] text-sm outline-none placeholder-[#444444] min-w-0"
              />
              <button type="submit" className="bg-white border-none px-4 sm:px-6 py-2.5 text-[#080808] font-['Outfit',sans-serif] font-bold text-[11px] tracking-[2px] cursor-pointer shrink-0">
                SEARCH
              </button>
            </div>

            {showDropdown && (
              <div className="absolute top-full left-0 right-0 bg-[rgba(8,8,8,0.97)] border border-[#222222] border-t-0 z-[100] max-h-80 overflow-y-auto backdrop-blur-md">
                {dropdownLoading ? (
                  <div className="p-3.5 flex items-center gap-2.5">
                    <div style={{ width: 14, height: 14, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                    <span className="text-xs text-[#444444]">Searching...</span>
                  </div>
                ) : dropdownResults.length === 0 ? (
                  <div className="p-3.5 text-xs text-[#333333]">No results found</div>
                ) : (
                  dropdownResults.map(m => (
                    <Link
                      to={`/manga/${m.id}`}
                      key={m.id}
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-3.5 py-2.5 no-underline border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors"
                    >
                      <img src={m.cover} alt={m.title} className="w-7 h-10 object-cover border border-[#2a2a2a] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-white font-semibold truncate">{m.title}</p>
                        <p className="text-[10px] text-[#555555] mt-0.5 truncate">{m.genres?.split(",").slice(0, 3).join(" · ")}</p>
                        <p className="text-[10px] text-[#aaaaaa] mt-0.5">★ {m.score}</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </form>
      )}

      {/* ── TOP RATED LABEL + DOTS ── */}
      {loading ? <HeroLabelSkeleton /> : (
        <div className="px-4 sm:px-10 pt-5 pb-2.5 flex items-center gap-3">
        <div className="w-7 h-0.5 bg-white shrink-0" />
        <span className="font-['Bebas_Neue',sans-serif] text-[13px] tracking-[3px] text-[#aaaaaa] whitespace-nowrap">Top Rated</span>
          <div className="flex gap-2 ml-auto shrink-0">
            {Array.from({ length: HERO_COUNT }).map((_, i) => (
              <span
                key={i}
                onClick={() => setHeroIndex(i)}
                className="h-[3px] w-7 cursor-pointer block transition-colors duration-200"
                style={{ background: i === heroIndex ? "#ffffff" : "#222222" }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      {loading ? <HeroSkeleton /> : (
        <div
          className="mx-4 sm:mx-10 mb-5 relative overflow-hidden border border-[#1a1a1a] bg-[#0a0a0a]"
          style={{ height: "clamp(260px, 52vw, 65vh)" }}
        >
          {heroManga && (
            <>
              <img src={heroManga.cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-[0.18]" style={{ filter: "blur(3px)" }} />
              <img
                src={heroManga.cover}
                alt={heroManga.title}
                className="hidden sm:block absolute right-10 lg:right-20 top-1/2 -translate-y-1/2 h-[90%] w-auto object-cover border border-[#2a2a2a] z-[1]"
                style={{ boxShadow: "0 12px 60px rgba(0,0,0,0.95)", opacity: 0, transition: "opacity 0.35s ease" }}
                onLoad={e => { e.currentTarget.style.opacity = 1 }}
              />
              <div className="hidden sm:block absolute inset-0 z-[2]" style={{ background: "linear-gradient(to right, #080808 42%, rgba(8,8,8,0.3) 65%, transparent 80%)" }} />
              <div className="sm:hidden absolute inset-0 z-[2]" style={{ background: "linear-gradient(to top, #080808 35%, rgba(8,8,8,0.75) 60%, rgba(8,8,8,0.3) 100%)" }} />
              <div className="absolute inset-0 z-[3] flex flex-col justify-end px-5 sm:px-12 pb-6 sm:pb-10 gap-1">
                <div style={{ maxWidth: "100%" }} className="sm:max-w-[55%]">
                  <p className="text-[10px] text-[#888888] font-bold tracking-[2px] uppercase mb-1">{heroManga.genres?.split(",")[0]?.trim()}</p>
                  <h1 className="font-['Bebas_Neue',sans-serif] leading-none tracking-[2px] sm:tracking-[3px] text-white" style={{ fontSize: heroManga.title.length > 40 ? "clamp(20px, 3.5vw, 42px)" : heroManga.title.length > 25 ? "clamp(26px, 5vw, 58px)" : "clamp(32px, 6.5vw, 72px)" }}>{heroManga.title}</h1>
                  <p className="text-[#888888] text-[12px] sm:text-[13px] mt-1.5 max-w-[440px] leading-[1.7] line-clamp-3 sm:line-clamp-none">
                    {heroDesc ? (heroDesc.length > 160 ? heroDesc.substring(0, 160) + "..." : heroDesc) : <span style={{ color: "#2a2a2a" }}>·····</span>}
                  </p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <Link to={`/manga/${heroManga.id}`} className="bg-white text-[#080808] px-5 sm:px-7 py-2.5 text-[11px] sm:text-[12px] font-bold tracking-[2px] no-underline font-['Outfit',sans-serif] shrink-0">READ NOW</Link>
                    <button
                      onClick={() => toggleBookmark(heroManga)}
                      className="px-5 sm:px-7 py-2.5 text-[11px] sm:text-[12px] font-bold tracking-[2px] cursor-pointer font-['Outfit',sans-serif] transition-all duration-200 shrink-0"
                      style={{ background: isBookmarked(heroManga.id) ? "#e8b84b" : "transparent", color: isBookmarked(heroManga.id) ? "#080808" : "#aaaaaa", border: `1px solid ${isBookmarked(heroManga.id) ? "#e8b84b" : "#2a2a2a"}` }}
                    >{isBookmarked(heroManga.id) ? "★ BOOKMARKED" : "+ BOOKMARK"}</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── GENRE CHIPS ── */}
      <div className="px-4 sm:px-10 pb-5 flex gap-2 flex-wrap">
        {GENRES.map(g => (
          <button key={g} onClick={() => { setGenre(g); setPage(1) }}
            style={{ padding: "5px 14px", border: `1px solid ${genre === g ? "#ffffff" : "#222222"}`, color: genre === g ? "#ffffff" : "#444444", background: genre === g ? "#ffffff18" : "transparent", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
            {g}
          </button>
        ))}
      </div>

      {/* ── RECENTLY ADDED ── */}
      <div className="px-4 sm:px-10 pb-8">
        {loading ? (<><SectionHeaderSkeleton /><MangaGridSkeleton count={8} cols="home-lg" /></>) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: "#dddddd" }}>Recently Added</h2>
              <Link to="/browse?sort=Recently+Added" style={{ fontSize: 11, color: "#aaaaaa", textDecoration: "none", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "#ffffff"} onMouseLeave={e => e.currentTarget.style.color = "#aaaaaa"}>View All →</Link>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 sm:gap-3">
              {recentlyAdded.map(m => (
                <Link to={`/manga/${m.id}`} key={m.id} style={{ textDecoration: "none", minWidth: 0 }}>
                  <div>
                    <div style={{ width: "100%", paddingBottom: "146%", position: "relative", border: "1px solid #1a1a1a", overflow: "hidden" }} onMouseEnter={e => e.currentTarget.style.borderColor = "#ffffff"} onMouseLeave={e => e.currentTarget.style.borderColor = "#1a1a1a"}>
                      <img src={m.cover} alt={m.title} loading="lazy" {...blurUp({ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" })} />
                      <div style={{ position: "absolute", top: 4, left: 4, background: m.type === "manga" ? "#3b82f6" : m.type === "manhwa" ? "#22c55e" : m.type === "manhua" ? "#f97316" : "#8b5cf6", color: "#ffffff", fontSize: 7, fontWeight: 700, padding: "1px 4px", letterSpacing: 0.5, textTransform: "uppercase", maxWidth: "calc(100% - 8px)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.type || "manga"}</div>
                    </div>
                    <p style={{ fontSize: 11, color: "#cccccc", marginTop: 6, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</p>
                    <p style={{ fontSize: 10, color: "#333333", marginTop: 1 }}>{m.genres?.split(",")[0]}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── TOP RATED MANGA ── */}
      <div className="px-4 sm:px-10 pb-8">
        {loading ? (<><SectionHeaderSkeleton /><MangaGridSkeleton count={8} cols="home-lg" /></>) : topRatedManga.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: "#dddddd" }}>Top Rated Manga</h2>
              <Link to="/browse?sort=Top+Rated&type=manga" style={{ fontSize: 11, color: "#aaaaaa", textDecoration: "none", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "#ffffff"} onMouseLeave={e => e.currentTarget.style.color = "#aaaaaa"}>View All →</Link>
            </div>
            <MangaRow items={topRatedManga} loading={false} />
          </>
        )}
      </div>

      {/* ── TOP RATED MANHWA / MANHUA ── */}
      <div className="px-4 sm:px-10 pb-8">
        {loading ? (<><SectionHeaderSkeleton /><MangaGridSkeleton count={8} cols="home-lg" /></>) : topRatedManhwa.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: "#dddddd" }}>Top Rated Manhwa & Manhua</h2>
              <Link to="/browse?sort=Top+Rated&type=manhwa" style={{ fontSize: 11, color: "#aaaaaa", textDecoration: "none", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "#ffffff"} onMouseLeave={e => e.currentTarget.style.color = "#aaaaaa"}>View All →</Link>
            </div>
            <MangaRow items={topRatedManhwa} loading={false} />
          </>
        )}
      </div>

      <div className="h-px bg-[#111111] mx-4 sm:mx-10 mb-7" />

      {/* ── BROWSE BY GENRE ── */}
      <div className="px-4 sm:px-10 pb-10">
        {loading ? (<><SectionHeaderSkeleton /><MangaGridSkeleton count={12} cols="browse" /></>) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: "#dddddd" }}>{genre === "All" ? "Browse All" : `Browse: ${genre}`}</h2>
              <Link to="/browse" style={{ fontSize: 11, color: "#aaaaaa", textDecoration: "none", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "#ffffff"} onMouseLeave={e => e.currentTarget.style.color = "#aaaaaa"}>View All →</Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
              {paginated.map(m => (
                <Link to={`/manga/${m.id}`} key={m.id} style={{ textDecoration: "none", minWidth: 0 }}>
                  <div>
                    <div style={{ width: "100%", paddingBottom: "146%", position: "relative", border: "1px solid #1a1a1a", overflow: "hidden" }} onMouseEnter={e => e.currentTarget.style.borderColor = "#ffffff"} onMouseLeave={e => e.currentTarget.style.borderColor = "#1a1a1a"}>
                      <img src={m.cover} alt={m.title} loading="lazy" {...blurUp({ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" })} />
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(4,4,4,.97))", padding: "16px 8px 6px" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#dddddd", margin: 0 }}>★ {m.score}</p>
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: "#cccccc", marginTop: 6, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</p>
                    <p style={{ fontSize: 10, color: "#333333", marginTop: 1 }}>{m.genres?.split(",")[0]}</p>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", gap: 4, marginTop: 28, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "7px 14px", border: "1px solid #222222", background: "transparent", color: page === 1 ? "#222222" : "#dddddd", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, cursor: page === 1 ? "default" : "pointer" }}>← Prev</button>
                {ellipsisPages(page, totalPages).map((p, i) => p === "..." ? (
                  <span key={`e-${i}`} style={{ padding: "7px 6px", color: "#333333", fontSize: 13, display: "flex", alignItems: "center" }}>···</span>
                ) : (
                  <button key={p} onClick={() => setPage(p)} style={{ padding: "7px 12px", border: `1px solid ${page === p ? "#ffffff" : "#222222"}`, background: page === p ? "#ffffff18" : "transparent", color: page === p ? "#ffffff" : "#444444", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", minWidth: 36 }}>{p}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "7px 14px", border: "1px solid #222222", background: "transparent", color: page === totalPages ? "#222222" : "#dddddd", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, cursor: page === totalPages ? "default" : "pointer" }}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}