import { useCallback } from "react"
import { supabase } from "../lib/supabaseClient"
import { useAuth } from "../context/AuthContext"

const PROGRESS_KEY = "yomuzuu_progress"

// --- localStorage helpers (matches your existing shape) ---
function getAll() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {} } catch { return {} }
}
function saveAll(data) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(data))
}

export function useReadProgress() {
  const { user } = useAuth()

  const markInProgress = useCallback(async (chapterId, page, total) => {
    if (user) {
      const { error } = await supabase.from("read_progress").upsert({
        user_id: user.id,
        chapter_id: String(chapterId),
        page,
        total,
        completed: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,chapter_id" })
      if (error) console.error("markInProgress:", error)
    } else {
      const all = getAll()
      all[chapterId] = { page, total, completed: false }
      saveAll(all)
    }
  }, [user])

  const markCompleted = useCallback(async (chapterId, total) => {
    if (user) {
      const { error } = await supabase.from("read_progress").upsert({
        user_id: user.id,
        chapter_id: String(chapterId),
        page: total,
        total,
        completed: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,chapter_id" })
      if (error) console.error("markCompleted:", error)
    } else {
      const all = getAll()
      all[chapterId] = { page: total, total, completed: true }
      saveAll(all)
    }
  }, [user])

  const getChapterProgress = useCallback(async (chapterId) => {
    if (user) {
      const { data, error } = await supabase
        .from("read_progress")
        .select("page, total, completed")
        .eq("user_id", user.id)
        .eq("chapter_id", String(chapterId))
        .single()
      if (error) return null
      return data
    } else {
      return getAll()[chapterId] || null
    }
  }, [user])

  return { markInProgress, markCompleted, getChapterProgress }
}