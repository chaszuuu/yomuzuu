import { useEffect, useRef } from "react"

export default function Modal({ isOpen, onClose, maxWidth = 420, closable = true, children }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && closable) onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [closable, onClose])

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current && closable) onClose()
  }

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        animation: "modalFadeIn 0.18s ease",
      }}
    >
      <style>{`
        @keyframes modalFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        .modal-inner::-webkit-scrollbar { width: 4px; }
        .modal-inner::-webkit-scrollbar-track { background: #080808; }
        .modal-inner::-webkit-scrollbar-thumb { background: #777777; }
        .modal-inner::-webkit-scrollbar-thumb:hover { background: #999999; }
      `}</style>
      <div
        className="modal-inner"
        style={{
          background: "#0d0d0d",
          border: "1px solid #1a1a1a",
          width: "100%",
          maxWidth,
          maxHeight: "90vh",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "#777777 #080808",
          animation: "modalSlideUp 0.2s ease",
        }}
      >
        {children}
      </div>
    </div>
  )
}