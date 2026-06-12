import { useState, useEffect, useCallback } from "react"
import { supabase } from "../lib/supabaseClient"
import { useAuth } from "../context/AuthContext"

const LS_KEY = "preferences"
const DEFAULTS = { readerMode: "scroll" }

const lsRead = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) || "{}") } } catch { return DEFAULTS } }
const lsWrite = (data) => localStorage.setItem(LS_KEY, JSON.stringify(data))

export function usePreferences() {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      if (user) {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("reader_mode")
          .eq("user_id", user.id)
          .single()

        if (!cancelled) {
          if (error || !data) {
            // No prefs saved yet — use localStorage defaults then upsert them
            const local = lsRead()
            setPreferences(local)
            await supabase.from("user_preferences").upsert({
              user_id: user.id,
              reader_mode: local.readerMode,
            }, { onConflict: "user_id" })
          } else {
            setPreferences({ readerMode: data.reader_mode })
          }
        }
      } else {
        if (!cancelled) setPreferences(lsRead())
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [user])

  const setReaderMode = useCallback(async (mode) => {
    setPreferences(prev => ({ ...prev, readerMode: mode }))

    if (user) {
      const { error } = await supabase.from("user_preferences").upsert({
        user_id: user.id,
        reader_mode: mode,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      if (error) console.error("setReaderMode:", error)
    } else {
      const current = lsRead()
      lsWrite({ ...current, readerMode: mode })
    }
  }, [user])

  return { preferences, setReaderMode, loading }
}