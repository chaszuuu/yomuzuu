import { Link } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import api from "../api"

const SCROLL_THRESHOLD = 30

export default function Navbar() {
  const [visible, setVisible] = useState(false)
  const [search, setSearch] = useState("")
  const [dropdownResults, setDropdownResults] = useState([])
  const [dropdownLoading, setDropdownLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY >= SCROLL_THRESHOLD)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (!search) {
      setShowDropdown(false)
      setDropdownResults([])
      return
    }
    setShowDropdown(true)
    setDropdownLoading(true)
    const timeout = setTimeout(() => {
      api.get(`/api/search?q=${search}`)
        .then(res => {
          const data = Array.isArray(res.data) ? res.data : []
          setDropdownResults(data.slice(0, 6))
          setDropdownLoading(false)
        })
    }, 500)
    return () => clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <nav
        className="border-b border-[#1a1a1a] fixed top-0 left-0 right-0 z-[999] bg-[rgba(8,8,8,0.92)] backdrop-blur-md"
        style={{ transform: visible ? "translateY(0)" : "translateY(-100%)", opacity: visible ? 1 : 0, transition: "transform 0.3s ease, opacity 0.3s ease", pointerEvents: visible ? "auto" : "none" }}
      >
        <div className="flex items-center justify-between px-4 sm:px-10 h-14 gap-3">
          <Link to="/" className="font-['Bebas_Neue',sans-serif] text-2xl tracking-widest text-[#dddddd] shrink-0">YOMUZUU</Link>

          <div ref={searchRef} className="relative hidden md:flex flex-1 max-w-sm mx-6 lg:mx-10">
            <div className="flex items-center bg-[#111111] border border-[#222222] w-full">
              <input type="text" placeholder="Quick search..." value={search} onChange={e => setSearch(e.target.value)} onFocus={() => search && setShowDropdown(true)} className="flex-1 bg-transparent border-none py-2 px-3.5 text-white font-['Outfit',sans-serif] text-xs outline-none placeholder-[#444444]" />
              <span className="pr-3 text-[#444444] text-sm">⌕</span>
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
                    <Link to={`/manga/${m.id}`} key={m.id} onClick={() => { setShowDropdown(false); setSearch("") }} className="flex items-center gap-3 px-3.5 py-2.5 no-underline border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
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

          <div className="hidden md:flex items-center gap-6 shrink-0">
            <Link to="/browse" className="text-sm font-semibold text-[#555555] hover:text-white transition-colors">Browse</Link>
            <Link to="/bookmarks" className="text-sm font-semibold text-[#555555] hover:text-white transition-colors">Bookmarks</Link>
          </div>

          <button className="md:hidden flex flex-col justify-center items-center gap-1.5 w-8 h-8 shrink-0" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <span className={`block w-5 h-0.5 bg-[#555555] transition-all ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-5 h-0.5 bg-[#555555] transition-all ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-[#555555] transition-all ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-[#1a1a1a] bg-[rgba(8,8,8,0.98)] px-4 py-4 flex flex-col gap-4">
            <div ref={searchRef} className="relative">
              <div className="flex items-center bg-[#111111] border border-[#222222]">
                <input type="text" placeholder="Search manga..." value={search} onChange={e => setSearch(e.target.value)} onFocus={() => search && setShowDropdown(true)} className="flex-1 bg-transparent border-none py-2.5 px-3.5 text-white font-['Outfit',sans-serif] text-sm outline-none placeholder-[#444444]" />
                <span className="pr-3 text-[#444444]">⌕</span>
              </div>
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 bg-[rgba(8,8,8,0.97)] border border-[#222222] border-t-0 z-[100] max-h-72 overflow-y-auto">
                  {dropdownLoading ? (
                    <div className="p-3 flex items-center gap-2">
                      <div style={{ width: 14, height: 14, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                      <span className="text-xs text-[#444444]">Searching...</span>
                    </div>
                  ) : dropdownResults.length === 0 ? (
                    <div className="p-3 text-xs text-[#333333]">No results found</div>
                  ) : (
                    dropdownResults.map(m => (
                      <Link to={`/manga/${m.id}`} key={m.id} onClick={() => { setShowDropdown(false); setSearch(""); setMenuOpen(false) }} className="flex items-center gap-3 px-3 py-2.5 no-underline border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                        <img src={m.cover} alt={m.title} className="w-7 h-10 object-cover border border-[#2a2a2a] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-white font-semibold truncate">{m.title}</p>
                          <p className="text-[10px] text-[#aaaaaa] mt-0.5">★ {m.score}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
            <Link to="/browse" onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-[#555555] hover:text-white transition-colors py-1">Browse</Link>
            <Link to="/bookmarks" onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-[#555555] hover:text-white transition-colors py-1">Bookmarks</Link>
          </div>
        )}
      </nav>
    </>
  )
}