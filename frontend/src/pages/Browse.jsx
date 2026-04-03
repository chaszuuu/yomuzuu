import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import api from "../api"
import Footer from "../components/Footer"
import { MangaGridSkeleton, TopbarSkeleton } from "../components/Skeletons"

const GENRES = ["All", "Action", "Romance", "Fantasy", "Horror", "Slice of Life", "Shounen", "Seinen", "Mystery", "Award Winning"]
const TYPES  = ["All", "Manga", "Manhwa", "Manhua"]
const SORTS  = ["Top Rated", "Recently Added", "A-Z", "Z-A"]
const PER_PAGE = 24

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

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [allManga, setAllManga]         = useState([])
  const [searchInput, setSearchInput]   = useState(searchParams.get("q") || "")
  const [search, setSearch]             = useState(searchParams.get("q") || "")
  const [genre, setGenre]               = useState(searchParams.get("genre") || "All")
  const [type, setType]                 = useState(searchParams.get("type") || "All")
  const [sort, setSort]                 = useState(searchParams.get("sort") || "Top Rated")
  const [page, setPage]                 = useState(1)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    api.get("/api/manga")
      .then(res => { setAllManga(Array.isArray(res.data) ? res.data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const params = {}
    if (genre !== "All") params.genre = genre
    if (type !== "All") params.type = type
    if (sort !== "Top Rated") params.sort = sort
    if (search) params.q = search
    setSearchParams(params)
    setPage(1)
  }, [genre, type, sort, search])

  const handleSearch = (e) => { e.preventDefault(); setSearch(searchInput) }

  let filtered = [...allManga]
  if (genre !== "All") filtered = filtered.filter(m => m.genres?.includes(genre))
  if (type !== "All") filtered = filtered.filter(m => {
    const t = m.type?.toLowerCase() || ""
    if (type === "Manga") return t === "manga"
    if (type === "Manhwa") return t === "manhwa"
    if (type === "Manhua") return t === "manhua"
    return true
  })
  if (search) filtered = filtered.filter(m => m.title?.toLowerCase().includes(search.toLowerCase()))
  if (sort === "Top Rated") filtered.sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0))
  else if (sort === "Recently Added") filtered.sort((a, b) => b.id - a.id)
  else if (sort === "A-Z") filtered.sort((a, b) => a.title?.localeCompare(b.title))
  else if (sort === "Z-A") filtered.sort((a, b) => b.title?.localeCompare(a.title))

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const pages      = ellipsisPages(page, totalPages)

  const hasFilters = search || genre !== "All" || type !== "All"

  return (
    <div className="bg-[#080808] min-h-screen text-white font-['Outfit',sans-serif] overflow-x-hidden">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* TOPBAR */}
      {loading ? <TopbarSkeleton showCount /> : (
        <div className="bg-[#050505] border-b border-[#222222] px-4 sm:px-10 py-3 relative z-50 flex items-center gap-2">
          <Link to="/" className="text-[#555555] no-underline hover:text-white transition-colors text-[12px] shrink-0">Home</Link>
          <span className="text-[#333333] text-[12px] shrink-0">/</span>
          <span className="text-[#aaaaaa] text-[12px]">Browse</span>
          <span className="text-[11px] text-[#333333] ml-auto tracking-widest uppercase">{filtered.length} titles</span>
        </div>
      )}

      {/* HEADER */}
      <div className="px-4 sm:px-10 pt-7 pb-1">
        <div className="flex items-center gap-3 mb-1"><div className="w-7 h-0.5 bg-white" /></div>
        <h1 className="font-['Bebas_Neue',sans-serif] text-4xl tracking-[3px] text-[#dddddd]">Browse</h1>
      </div>

      {/* SEARCH + SORT */}
      <div className="px-4 sm:px-10 pt-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <form onSubmit={handleSearch} className="flex flex-1">
          <input type="text" placeholder="Search titles..." value={searchInput}
            onChange={e => { setSearchInput(e.target.value); setSearch(e.target.value) }}
            className="flex-1 bg-[#111111] border border-[#222222] border-r-0 px-4 py-2.5 text-white font-['Outfit',sans-serif] text-sm outline-none placeholder-[#444444]" />
          <button type="submit" className="bg-white border-none px-5 py-2.5 text-[#080808] font-['Outfit',sans-serif] font-bold text-xs tracking-widest cursor-pointer shrink-0">SEARCH</button>
          {search && (
            <button type="button" onClick={() => { setSearch(""); setSearchInput("") }}
              className="bg-[#1a1a1a] border border-[#222222] border-l-0 px-3.5 text-[#aaaaaa] cursor-pointer text-sm">✕</button>
          )}
        </form>
        <div className="flex gap-1.5 flex-wrap">
          {SORTS.map(s => (
            <button key={s} onClick={() => setSort(s)} className="px-3 py-2.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors"
              style={{ border: `1px solid ${sort === s ? "#ffffff" : "#222222"}`, background: sort === s ? "#ffffff18" : "transparent", color: sort === s ? "#ffffff" : "#444444" }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* TYPE FILTER */}
      <div className="px-4 sm:px-10 pt-4 flex gap-2 flex-wrap items-center">
        <span className="text-[10px] text-[#333333] font-bold tracking-[2px] uppercase mr-1">Type</span>
        {TYPES.map(t => {
          const typeColor = t === "Manga" ? "#3b82f6" : t === "Manhwa" ? "#22c55e" : t === "Manhua" ? "#f97316" : "#ffffff"
          const isActive = type === t
          return (
            <button key={t} onClick={() => setType(t)} className="px-3.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors"
              style={{ border: `1px solid ${isActive ? typeColor : "#222222"}`, color: isActive ? typeColor : "#444444", background: isActive ? `${typeColor}18` : "transparent" }}>
              {t}
            </button>
          )
        })}
      </div>

      {/* GENRE CHIPS */}
      <div className="px-4 sm:px-10 pt-3 flex gap-2 flex-wrap items-center">
        <span className="text-[10px] text-[#333333] font-bold tracking-[2px] uppercase mr-1">Genre</span>
        {GENRES.map(g => (
          <button key={g} onClick={() => setGenre(g)} className="px-3.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors"
            style={{ border: `1px solid ${genre === g ? "#ffffff" : "#222222"}`, color: genre === g ? "#ffffff" : "#444444", background: genre === g ? "#ffffff18" : "transparent" }}>
            {g}
          </button>
        ))}
      </div>

      {/* ACTIVE FILTERS */}
      {hasFilters && (
        <div className="px-4 sm:px-10 pt-3 flex gap-2 items-center flex-wrap">
          <span className="text-[11px] text-[#333333]">Filtering by:</span>
          {type !== "All" && (() => {
  const typeColor = type === "Manga" ? "#3b82f6" : type === "Manhwa" ? "#22c55e" : type === "Manhua" ? "#f97316" : "#ffffff"
  return (
    <span className="px-2.5 py-0.5 text-[11px] flex items-center gap-1.5"
      style={{ border: `1px solid ${typeColor}`, color: typeColor, background: `${typeColor}18` }}>
      {type}<span onClick={() => setType("All")} className="cursor-pointer opacity-60">✕</span>
    </span>
  )
})()}
          {genre !== "All" && (
            <span className="px-2.5 py-0.5 bg-[#ffffff18] border border-white text-white text-[11px] flex items-center gap-1.5">
              {genre}<span onClick={() => setGenre("All")} className="cursor-pointer opacity-60">✕</span>
            </span>
          )}
          {search && (
            <span className="px-2.5 py-0.5 bg-[#ffffff18] border border-white text-white text-[11px] flex items-center gap-1.5">
              "{search}"<span onClick={() => { setSearch(""); setSearchInput("") }} className="cursor-pointer opacity-60">✕</span>
            </span>
          )}
          <button onClick={() => { setGenre("All"); setType("All"); setSearch(""); setSearchInput("") }}
            className="bg-transparent border-none text-[#333333] text-[11px] cursor-pointer underline">Clear all</button>
        </div>
      )}

      {/* GRID */}
      <div className="px-4 sm:px-10 pt-6 pb-10">
        {loading ? (
          <MangaGridSkeleton count={24} cols="browse" />
        ) : paginated.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#333333] text-sm">No titles found for your filters.</p>
            <button onClick={() => { setGenre("All"); setType("All"); setSearch(""); setSearchInput("") }}
              className="mt-4 bg-white border-none text-[#080808] px-6 py-2.5 font-['Outfit',sans-serif] font-bold text-xs cursor-pointer tracking-wide">CLEAR FILTERS</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {paginated.map((m, i) => (
              <Link to={`/manga/${m.id}`} key={m.id} className="no-underline min-w-0">
                <div>
                  <div className="w-full relative border border-[#1a1a1a] overflow-hidden hover:border-white transition-colors" style={{ paddingBottom: "146%" }}>
                    <img src={m.cover} alt={m.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    {sort === "Top Rated" && page === 1 && i < 3 && (
                      <div className="absolute top-0 left-0 text-[#080808] text-[9px] font-black px-1.5 py-0.5 tracking-wide"
                        style={{ background: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : "#cd7f32" }}>#{i + 1}</div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[rgba(4,4,4,0.97)] to-transparent px-2 pb-1.5 pt-4">
                      <p className="text-[11px] font-bold text-[#dddddd] m-0">★ {m.score}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#cccccc] mt-1.5 font-semibold leading-tight truncate">{m.title}</p>
                  <p className="text-[10px] text-[#333333] mt-0.5">{m.genres?.split(",")[0]?.trim()}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* PAGINATION */}
        {!loading && totalPages > 1 && (
          <div className="flex gap-1 mt-10 justify-center items-center flex-wrap">
            <button onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo(0, 0) }} disabled={page === 1}
              className="px-4 py-1.5 border border-[#222222] bg-transparent font-['Outfit',sans-serif] text-xs font-bold cursor-pointer"
              style={{ color: page === 1 ? "#222222" : "#dddddd" }}>← Prev</button>
            {pages.map((p, i) => p === "..." ? (
              <span key={`e-${i}`} className="px-1.5 py-1.5 text-[#333333] text-sm">...</span>
            ) : (
              <button key={p} onClick={() => { setPage(p); window.scrollTo(0, 0) }}
                className="px-3 py-1.5 font-['Outfit',sans-serif] text-xs font-bold cursor-pointer"
                style={{ border: `1px solid ${page === p ? "#ffffff" : "#222222"}`, background: page === p ? "#ffffff18" : "transparent", color: page === p ? "#ffffff" : "#444444" }}>{p}</button>
            ))}
            <button onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo(0, 0) }} disabled={page === totalPages}
              className="px-4 py-1.5 border border-[#222222] bg-transparent font-['Outfit',sans-serif] text-xs font-bold cursor-pointer"
              style={{ color: page === totalPages ? "#222222" : "#dddddd" }}>Next →</button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}