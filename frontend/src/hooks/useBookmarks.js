import { useState, useEffect, useCallback } from "react"

const KEY = "bookmarks"
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]") } catch { return [] } }

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState(read)

  // Keep in sync if another tab changes localStorage
  useEffect(() => {
    const onStorage = (e) => { if (e.key === KEY) setBookmarks(read()) }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const toggleBookmark = useCallback((manga) => {
    if (!manga) return
    setBookmarks(prev => {
      const exists = prev.some(b => b.id === manga.id)
      const next = exists
        ? prev.filter(b => b.id !== manga.id)
        : [...prev, { id: manga.id, title: manga.title, cover: manga.cover, score: manga.score }]
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const isBookmarked = useCallback((id) => bookmarks.some(b => b.id === id), [bookmarks])

  return { bookmarks, isBookmarked, toggleBookmark }
}