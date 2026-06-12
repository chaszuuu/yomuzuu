import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"
import { useEffect } from "react"
import { AuthProvider } from "./context/AuthContext"
import Home from "./pages/Home"
import MangaDetail from "./pages/MangaDetail"
import Chapter from "./pages/Chapter"
import Navbar from "./components/Navbar"
import Bookmarks from "./pages/Bookmarks"
import Browse from "./pages/Browse"
import ChangelogModal from "./modals/ChangelogModal"


function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function NotFound() {
  return (
    <div style={{ background: "#080808", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "'Outfit', sans-serif" }}>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 80, color: "#1a1a1a", letterSpacing: 4, margin: 0 }}>404</p>
      <p style={{ fontSize: 12, color: "#333333", letterSpacing: 2, textTransform: "uppercase" }}>Page not found</p>
      <a href="/" style={{ fontSize: 11, color: "#555555", letterSpacing: 2, textTransform: "uppercase", textDecoration: "none", borderBottom: "1px solid #222222", paddingBottom: 2 }}>
        Back to Home
      </a>
    </div>
  )
}

function Layout() {
  const location = useLocation()
  const hideNavbar = location.pathname.startsWith("/chapter/")

  return (
    <>
      <ScrollToTop />
      <ChangelogModal/>
      {!hideNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/manga/:id" element={<MangaDetail />} />
        <Route path="/chapter/:id" element={<Chapter />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </AuthProvider>
  )
}