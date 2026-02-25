export default function Footer() {
  return (
    <footer className="border-t border-[#111111] bg-[#050505] px-5 sm:px-10 py-7 flex flex-col sm:flex-row items-center justify-between gap-3 font-['Outfit',sans-serif]">
      <div className="text-center sm:text-left">
        <p className="font-['Bebas_Neue',sans-serif] text-lg tracking-[3px] text-[#aaaaaa]">YOMUZUU</p>
        <p className="text-[11px] text-[#aaaaaa] mt-1">© 2026 Yomuzuu</p>
      </div>
      <div className="text-center text-[11px] text-[#aaaaaa]">
        Data provided by <a href="https://myanimelist.net" target="_blank" rel="noopener noreferrer" className="text-white font-bold hover:underline">MyAnimeList</a>
      </div>
      <div className="flex items-center gap-1 text-xs text-[#aaaaaa]">
        Made with <span className="text-[#ff0040] text-base">♥</span> by <span className="text-white font-bold">chaszuu</span>
      </div>
    </footer>
  )
}