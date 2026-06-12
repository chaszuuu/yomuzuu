import { AVATARS } from "../assets/avatars"

export default function AvatarPicker({ selected, onSelect }) {
  return (
    <>
      <style>{`
        .av-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
        @media (max-width: 480px) { .av-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; } }
        @media (min-width: 481px) and (max-width: 768px) { .av-grid { grid-template-columns: repeat(4, 1fr); gap: 9px; } }
        .av-opt { cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; transition: all 0.15s ease; border-radius: 50%; }
        .av-opt:hover .av-wrap { opacity: 0.85; }
        .av-wrap { position: relative; border-radius: 50%; overflow: hidden; border: 2px solid transparent; transition: border-color 0.15s, transform 0.15s; width: 100%; aspect-ratio: 1/1; }
        .av-wrap.selected { border-color: #e8b84b; transform: scale(1.06); }
        .av-wrap:not(.selected) { opacity: 0.5; }
        .av-wrap:not(.selected):hover { opacity: 0.85; }
        .av-check { position: absolute; bottom: 3px; right: 3px; width: 14px; height: 14px; border-radius: 50%; background: #e8b84b; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #080808; font-weight: 900; }
      `}</style>
      <div className="av-grid">
        {AVATARS.map(av => (
          <div key={av.id} className="av-opt" onClick={() => onSelect(av.id)}>
            <div className={`av-wrap${selected === av.id ? " selected" : ""}`}>
              <img
                src={av.src}
                alt={av.label}
                style={{ width: "100%", aspectRatio: "1/1", display: "block", objectFit: "cover" }}
              />
              {selected === av.id && <div className="av-check">✓</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}