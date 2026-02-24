/**
 * Skeletons.jsx — Yomuzuu Skeleton Loader System
 *
 * All skeletons match the exact responsive layout, spacing, aspect ratios,
 * and breakpoints of the real components. Uses a sharp shimmer sweep
 * (not just pulse) that fits the dark, editorial aesthetic of the site.
 *
 * Exports:
 *   SkeletonBase          — raw shimmer block, accepts className
 *   MangaCardSkeleton     — single card (cover + title + genre line)
 *   MangaGridSkeleton     — full responsive grid of cards
 *   HeroSkeleton          — home hero / slideshow section
 *   HeroLabelSkeleton     — the "Top Rated Mangas" label + dots row
 *   MangaDetailHeroSkeleton — banner hero on detail page
 *   MangaDetailBodySkeleton — synopsis + chapter list columns
 *   ChapterListSkeleton   — standalone chapter rows
 *   ReaderSkeleton        — chapter reader image stack
 *   SectionHeaderSkeleton — section title + "View All" row
 */

// ─── Shimmer base ──────────────────────────────────────────────────────────────
// A single CSS keyframe injected once; all skeletons share it.

const SHIMMER_STYLE = `
  @keyframes yomu-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  .yomu-shimmer {
    background: linear-gradient(
      105deg,
      #111111 0%,
      #111111 35%,
      #1e1e1e 45%,
      #2a2a2a 50%,
      #1e1e1e 55%,
      #111111 65%,
      #111111 100%
    );
    background-size: 200% 100%;
    animation: yomu-shimmer 1.6s ease-in-out infinite;
  }
`

let styleInjected = false
function injectShimmerStyle() {
  if (styleInjected || typeof document === "undefined") return
  styleInjected = true
  const el = document.createElement("style")
  el.textContent = SHIMMER_STYLE
  document.head.appendChild(el)
}

// ─── SkeletonBase ──────────────────────────────────────────────────────────────
export function SkeletonBase({ className = "", style = {} }) {
  injectShimmerStyle()
  return (
    <div
      className={`yomu-shimmer ${className}`}
      style={style}
      aria-hidden="true"
    />
  )
}

// ─── MangaCardSkeleton ─────────────────────────────────────────────────────────
// Matches: cover image (146% aspect-ratio) + title line + genre line
export function MangaCardSkeleton() {
  injectShimmerStyle()
  return (
    <div className="min-w-0" aria-hidden="true">
      {/* Cover — 146% aspect ratio box, same as real card */}
      <div className="w-full relative border border-[#1a1a1a]" style={{ paddingBottom: "146%" }}>
        <SkeletonBase className="absolute inset-0 w-full h-full" />
      </div>
      {/* Title */}
      <SkeletonBase className="h-[11px] mt-2 rounded-none" style={{ width: "80%" }} />
      {/* Genre */}
      <SkeletonBase className="h-[10px] mt-1.5 rounded-none" style={{ width: "45%" }} />
    </div>
  )
}

// ─── MangaGridSkeleton ─────────────────────────────────────────────────────────
// count prop controls number of cards. Default matches page PER_PAGE values.
// cols prop: "browse" = 2→3→4→5→6, "home-lg" = 2→4→6→8 (recently added / top rated)
export function MangaGridSkeleton({ count = 12, cols = "browse" }) {
  const colClass =
    cols === "home-lg"
      ? "grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
      : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"

  return (
    <div className={`grid ${colClass} gap-3`} aria-busy="true" aria-label="Loading manga">
      {Array.from({ length: count }).map((_, i) => (
        <MangaCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ─── SectionHeaderSkeleton ─────────────────────────────────────────────────────
// Matches: h2 title + "View All →" link row
export function SectionHeaderSkeleton() {
  injectShimmerStyle()
  return (
    <div className="flex items-center justify-between mb-4" aria-hidden="true">
      <SkeletonBase className="h-[18px] w-36 rounded-none" />
      <SkeletonBase className="h-[11px] w-16 rounded-none" />
    </div>
  )
}

// ─── HeroLabelSkeleton ─────────────────────────────────────────────────────────
// Matches: white bar + "Top Rated Mangas" label + dots row
export function HeroLabelSkeleton() {
  injectShimmerStyle()
  return (
    <div className="px-4 sm:px-10 pt-5 pb-2.5 flex items-center gap-3" aria-hidden="true">
      <div className="w-7 h-0.5 bg-[#1a1a1a]" />
      <SkeletonBase className="h-[13px] w-40 rounded-none" />
      <div className="flex gap-2 ml-auto">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-[3px] w-7 bg-[#1a1a1a]" />
        ))}
      </div>
    </div>
  )
}

// ─── HeroSkeleton ──────────────────────────────────────────────────────────────
// Matches: mx-4 sm:mx-10, clamp height, left content block
export function HeroSkeleton() {
  injectShimmerStyle()
  return (
    <div
      className="mx-4 sm:mx-10 mb-5 relative overflow-hidden border border-[#1a1a1a] bg-[#0a0a0a]"
      style={{ height: "clamp(280px, 55vw, 65vh)" }}
      aria-hidden="true"
    >
      {/* Full BG shimmer */}
      <SkeletonBase className="absolute inset-0 w-full h-full" />

      {/* Content overlay — left column, bottom-anchored */}
      <div className="absolute inset-0 px-5 sm:px-12 pb-8 sm:pb-10 flex flex-col justify-end gap-3 z-10">
        {/* Genre label */}
        <SkeletonBase className="h-[10px] w-20 rounded-none" style={{ background: "rgba(255,255,255,0.04)" }} />
        {/* Title — large */}
        <SkeletonBase className="h-12 sm:h-16 lg:h-20 w-3/4 rounded-none" style={{ background: "rgba(255,255,255,0.04)" }} />
        {/* Description lines */}
        <div className="flex flex-col gap-1.5 max-w-md">
          <SkeletonBase className="h-3 rounded-none w-full" style={{ background: "rgba(255,255,255,0.03)" }} />
          <SkeletonBase className="h-3 rounded-none w-5/6" style={{ background: "rgba(255,255,255,0.03)" }} />
          <SkeletonBase className="h-3 rounded-none w-4/6 hidden sm:block" style={{ background: "rgba(255,255,255,0.03)" }} />
        </div>
        {/* Buttons */}
        <div className="flex gap-2.5 mt-2 flex-wrap">
          <SkeletonBase className="h-10 w-28 rounded-none" style={{ background: "rgba(255,255,255,0.06)" }} />
          <SkeletonBase className="h-10 w-32 rounded-none" style={{ background: "rgba(255,255,255,0.03)" }} />
        </div>
      </div>
    </div>
  )
}

// ─── MangaDetailHeroSkeleton ───────────────────────────────────────────────────
// Matches: clamp(260px, 50vw, 420px) banner with cover + info side by side
export function MangaDetailHeroSkeleton() {
  injectShimmerStyle()
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: "clamp(260px, 50vw, 420px)" }}
      aria-hidden="true"
    >
      {/* Full bg shimmer */}
      <SkeletonBase className="absolute inset-0 w-full h-full" />

      {/* Inner content — cover + info, bottom aligned */}
      <div className="absolute inset-0 max-w-5xl mx-auto px-4 sm:px-12 flex flex-row items-end pb-6 sm:pb-10 gap-5 sm:gap-10">
        {/* Cover */}
        <div
          className="shrink-0 border border-[#2a2a2a]"
          style={{
            width: "clamp(80px, 15vw, 200px)",
            height: "clamp(116px, 22vw, 290px)",
            background: "rgba(0,0,0,0.3)",
          }}
        />

        {/* Info column */}
        <div className="pb-1 min-w-0 flex-1 flex flex-col gap-2.5">
          <SkeletonBase className="h-[10px] w-20 rounded-none" style={{ background: "rgba(255,255,255,0.04)" }} />
          <SkeletonBase
            className="rounded-none"
            style={{ height: "clamp(28px, 4vw, 48px)", width: "70%", background: "rgba(255,255,255,0.05)" }}
          />
          <div className="flex gap-3 flex-wrap">
            <SkeletonBase className="h-3 w-12 rounded-none" style={{ background: "rgba(255,255,255,0.04)" }} />
            <SkeletonBase className="h-3 w-20 rounded-none" style={{ background: "rgba(255,255,255,0.04)" }} />
            <SkeletonBase className="h-3 w-16 rounded-none" style={{ background: "rgba(255,255,255,0.04)" }} />
          </div>
          {/* Genre tags — desktop only */}
          <div className="hidden sm:flex gap-1.5 flex-wrap">
            {[60, 50, 70, 55].map((w, i) => (
              <SkeletonBase key={i} className="h-[22px] rounded-none" style={{ width: w, background: "rgba(255,255,255,0.03)" }} />
            ))}
          </div>
          {/* Action buttons */}
          <div className="flex gap-2.5 flex-wrap mt-1">
            <SkeletonBase className="h-9 w-28 rounded-none" style={{ background: "rgba(255,255,255,0.06)" }} />
            <SkeletonBase className="h-9 w-32 rounded-none" style={{ background: "rgba(255,255,255,0.03)" }} />
            <SkeletonBase className="h-9 w-28 rounded-none" style={{ background: "rgba(255,255,255,0.03)" }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ChapterListSkeleton ───────────────────────────────────────────────────────
// Matches: border box with rows of chapter title + date
export function ChapterListSkeleton({ count = 10 }) {
  injectShimmerStyle()
  return (
    <div className="flex flex-col border border-[#1a1a1a]" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="grid gap-2 px-4 py-3"
          style={{
            gridTemplateColumns: "1fr auto",
            borderBottom: i < count - 1 ? "1px solid #111111" : "none",
          }}
        >
          {/* Chapter title */}
          <SkeletonBase
            className="h-[13px] rounded-none"
            style={{ width: `${55 + ((i * 17) % 35)}%` }}
          />
          {/* Date */}
          <SkeletonBase className="h-[11px] w-16 rounded-none shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ─── MangaDetailBodySkeleton ───────────────────────────────────────────────────
// Matches: flex-col md:flex-row, synopsis left + chapters right
export function MangaDetailBodySkeleton({ chapterCount = 10 }) {
  injectShimmerStyle()
  return (
    <div
      className="max-w-5xl mx-auto px-4 sm:px-12 py-8 sm:py-10 flex flex-col md:flex-row gap-8 md:gap-10"
      aria-hidden="true"
    >
      {/* LEFT — synopsis */}
      <div className="md:w-[200px] shrink-0 flex flex-col gap-2">
        {/* "Synopsis" label */}
        <SkeletonBase className="h-[10px] w-16 rounded-none mb-0.5" />
        {/* Synopsis text lines — varied widths */}
        {[100, 90, 100, 85, 95, 100, 78, 88, 100, 60].map((w, i) => (
          <SkeletonBase key={i} className="h-[13px] rounded-none" style={{ width: `${w}%` }} />
        ))}
      </div>

      {/* RIGHT — chapters */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <SkeletonBase className="h-[18px] w-24 rounded-none" />
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <SkeletonBase key={i} className="h-7 w-10 rounded-none" />
            ))}
          </div>
        </div>
        <ChapterListSkeleton count={chapterCount} />
      </div>
    </div>
  )
}

// ─── ReaderSkeleton ────────────────────────────────────────────────────────────
// Matches: centered column of manga images, max-w-[720px], variable heights
// pageCount: number of skeleton "pages" to show
export function ReaderSkeleton({ pageCount = 4 }) {
  injectShimmerStyle()
  // Vary the height of each fake page for realism
  const heights = [1400, 1200, 1350, 1280, 1420, 1300]

  return (
    <div className="pt-[52px] pb-24 flex flex-col items-center" aria-hidden="true">
      {Array.from({ length: pageCount }).map((_, i) => (
        <div
          key={i}
          className="w-full max-w-[720px] leading-none"
          style={{ height: heights[i % heights.length] }}
        >
          <SkeletonBase className="w-full h-full" />
        </div>
      ))}
    </div>
  )
}

// ─── TopbarSkeleton ────────────────────────────────────────────────────────────
// The breadcrumb / back button bar used on Browse, Bookmarks, MangaDetail
export function TopbarSkeleton({ showCount = false }) {
  injectShimmerStyle()
  return (
    <div
      className="bg-[#050505] border-b border-[#222222] px-4 sm:px-10 py-3 flex items-center gap-3 flex-wrap"
      aria-hidden="true"
    >
      <SkeletonBase className="h-9 w-20 rounded-none" />
      <div className="flex items-center gap-2">
        <SkeletonBase className="h-3 w-10 rounded-none" />
        <div className="w-1 h-1 bg-[#222222] rounded-full" />
        <SkeletonBase className="h-3 w-16 rounded-none" />
      </div>
      {showCount && <SkeletonBase className="h-3 w-14 rounded-none ml-auto" />}
    </div>
  )
}

// ─── PageTitleSkeleton ─────────────────────────────────────────────────────────
// "YOUR LIBRARY" label + big heading (used on Bookmarks)
export function PageTitleSkeleton() {
  injectShimmerStyle()
  return (
    <div className="px-4 sm:px-10 pt-7 pb-6 border-b border-[#111111]" aria-hidden="true">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-7 h-0.5 bg-[#1a1a1a]" />
        <SkeletonBase className="h-3 w-24 rounded-none" />
      </div>
      <SkeletonBase className="h-12 w-48 rounded-none" />
    </div>
  )
}

// ─── SearchBarSkeleton ─────────────────────────────────────────────────────────
// The top search bar on the Home page
export function SearchBarSkeleton() {
  injectShimmerStyle()
  return (
    <div className="px-4 sm:px-10 py-3 bg-[#050505] border-b border-[#1a1a1a]" aria-hidden="true">
      <div className="flex">
        <SkeletonBase className="flex-1 h-10 rounded-none" />
        <SkeletonBase className="w-20 h-10 rounded-none ml-0" style={{ background: "#1a1a1a" }} />
      </div>
    </div>
  )
}