import axios from "axios"

// ── Toast (no dependencies) ───────────────────────────────────────────────────
let _toastTimer = null
function showToast(msg, type = "error") {
  if (!document.getElementById("_yt_style")) {
    const s = document.createElement("style")
    s.id = "_yt_style"
    s.textContent = `
      #_yt {
        position:fixed; bottom:68px; left:50%;
        transform:translateX(-50%) translateY(10px);
        background:#111; border:1px solid #2a2a2a;
        color:#ccc; font-family:'Outfit',sans-serif;
        font-size:12px; letter-spacing:.4px; padding:9px 20px;
        z-index:99999; opacity:0; pointer-events:none; white-space:nowrap;
        transition:opacity .2s,transform .2s;
      }
      #_yt.show { opacity:1; transform:translateX(-50%) translateY(0); }
      #_yt.err  { border-color:#3a1212; color:#f87171; }
      #_yt.warn { border-color:#3a2e00; color:#e8b84b; }
    `
    document.head.appendChild(s)
  }
  let el = document.getElementById("_yt")
  if (!el) { el = document.createElement("div"); el.id = "_yt"; document.body.appendChild(el) }
  clearTimeout(_toastTimer)
  el.textContent = msg
  el.className = type === "warn" ? "warn" : "err"
  void el.offsetWidth // force reflow
  el.classList.add("show")
  _toastTimer = setTimeout(() => el.classList.remove("show"), 3500)
}

// ── Axios instance (your original, untouched) ─────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
  headers: {
    "X-API-Key": import.meta.env.VITE_API_KEY || ""
  }
})

// ── Global error interceptor ──────────────────────────────────────────────────
api.interceptors.response.use(
  res => res,
  err => {
    const status = err.response?.status
    if (!err.response)               showToast("Network error — check your connection")
    else if (status === 429)         showToast("Too many requests — slow down a bit", "warn")
    else if (status >= 500)          showToast("Server error — try again in a moment")
    else if (status === 401 || status === 403) showToast("Access denied")
    // 404: handled per-component, skip toast

    console.error(`[api] ${err.config?.method?.toUpperCase()} ${err.config?.url} → ${status ?? "no response"}`)
    return Promise.reject(err)
  }
)

export default api