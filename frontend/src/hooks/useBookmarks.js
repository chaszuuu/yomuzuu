import { useState, useEffect, useCallback } from "react"
import { supabase } from "../lib/supabaseClient"
import { useAuth } from "../context/AuthContext"

const LS_KEY = "bookmarks"

// --- localStorage helpers (guest) ---
const lsRead = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]") } catch { return [] } }
const lsWrite = (data) => localStorage.setItem(LS_KEY, JSON.stringify(data))

// --- Supabase helpers (logged in) ---
async function fetchDbBookmarks(userId) {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("manga_id, manga_title, manga_cover")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) { console.error("fetchDbBookmarks:", error); return [] }
  return data.map(b => ({ id: b.manga_id, title: b.manga_title, cover: b.manga_cover }))
}

async function addDbBookmark(userId, manga) {
  const { error } = await supabase.from("bookmarks").upsert({
    user_id: userId,
    manga_id: manga.id,
    manga_title: manga.title,
    manga_cover: manga.cover,
  }, { onConflict: "user_id,manga_id" })
  if (error) console.error("addDbBookmark:", error)
}

async function removeDbBookmark(userId, mangaId) {
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("manga_id", mangaId)
  if (error) console.error("removeDbBookmark:", error)
}

// --- Migration: merge localStorage bookmarks into DB on first login ---
async function migrateLocalToDb(userId) {
  const local = lsRead()
  if (!local.length) return
  const rows = local.map(b => ({
    user_id: userId,
    manga_id: b.id,
    manga_title: b.title,
    manga_cover: b.cover,
  }))
  const { error } = await supabase
    .from("bookmarks")
    .upsert(rows, { onConflict: "user_id,manga_id" })
  if (!error) {
    localStorage.removeItem(LS_KEY)
    console.log(`Migrated ${local.length} bookmark(s) from localStorage to account.`)
  }
}

export function useBookmarks() {
  const { user } = useAuth()
  const [bookmarks, setBookmarks] = useState([])
  const [loading, setLoading] = useState(true)

  // Load bookmarks whenever auth state changes
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      if (user) {
        // Migrate any local bookmarks first, then fetch from DB
        await migrateLocalToDb(user.id)
        const db = await fetchDbBookmarks(user.id)
        if (!cancelled) setBookmarks(db)
      } else {
        // Guest: use localStorage
        if (!cancelled) setBookmarks(lsRead())
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [user])

  // Keep guest bookmarks in sync across tabs
  useEffect(() => {
    if (user) return
    const onStorage = (e) => { if (e.key === LS_KEY) setBookmarks(lsRead()) }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [user])

  const toggleBookmark = useCallback(async (manga) => {
    if (!manga) return
    const exists = bookmarks.some(b => b.id === manga.id)

    if (user) {
      // Optimistic update
      setBookmarks(prev =>
        exists
          ? prev.filter(b => b.id !== manga.id)
          : [{ id: manga.id, title: manga.title, cover: manga.cover }, ...prev]
      )
      if (exists) await removeDbBookmark(user.id, manga.id)
      else await addDbBookmark(user.id, manga)
    } else {
      // Guest: localStorage only
      setBookmarks(prev => {
        const next = exists
          ? prev.filter(b => b.id !== manga.id)
          : [...prev, { id: manga.id, title: manga.title, cover: manga.cover, score: manga.score }]
        lsWrite(next)
        return next
      })
    }
  }, [bookmarks, user])

  const isBookmarked = useCallback((id) => bookmarks.some(b => b.id === id), [bookmarks])

  return { bookmarks, isBookmarked, toggleBookmark, loading }
}