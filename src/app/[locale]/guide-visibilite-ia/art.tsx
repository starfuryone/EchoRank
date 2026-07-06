import s from "./guide-ia.module.css";

export function GuideHeroArt({ label }: { label: string }) {
  return (
    <div className={s.artRow} role="img" aria-label={label}>
      <svg viewBox="0 0 440 150" xmlns="http://www.w3.org/2000/svg">
        <rect x="60" y="18" width="320" height="114" rx="14" className={s.dbox} />
        <circle cx="92" cy="48" r="9" className={s.dln} />
        <line x1="112" y1="44" x2="330" y2="44" className={s.dln} />
        <line x1="112" y1="54" x2="290" y2="54" className={s.dln} />
        <line x1="92" y1="84" x2="320" y2="84" className={s.dgold} />
        <circle cx="338" cy="84" r="4" className={s.dgoldFill} />
        <circle cx="338" cy="84" r="14" className={`${s.dgold} ${s.dping}`} style={{ transformOrigin: "338px 84px" }} />
        <line x1="92" y1="108" x2="260" y2="108" className={s.dln} />
      </svg>
    </div>
  );
}

export function SerpToAnswerArt({ label }: { label: string }) {
  return (
    <div className={s.artRow} role="img" aria-label={label}>
      <svg viewBox="0 0 440 140" xmlns="http://www.w3.org/2000/svg">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <rect x="30" y={22 + i * 20} width="10" height="10" className={s.dln} rx="2" />
            <line x1="50" y1={27 + i * 20} x2="150" y2={27 + i * 20} className={s.dln} />
          </g>
        ))}
        <line x1="180" y1="70" x2="250" y2="70" className={`${s.dgold} ${s.dflow}`} />
        <path d="M 244 63 L 254 70 L 244 77" className={s.dgold} />
        <rect x="272" y="38" width="140" height="64" rx="12" className={s.dbox} />
        <line x1="290" y1="62" x2="394" y2="62" className={s.dgold} />
        <circle cx="290" cy="80" r="3.5" className={s.dgoldFill} />
        <line x1="302" y1="80" x2="370" y2="80" className={s.dln} />
      </svg>
    </div>
  );
}

export function ChecklistArt({ label }: { label: string }) {
  return (
    <div className={s.artRow} role="img" aria-label={label}>
      <svg viewBox="0 0 440 120" xmlns="http://www.w3.org/2000/svg">
        <rect x="120" y="20" width="80" height="80" rx="14" className={s.dbox} />
        <path d="M 142 62 L 158 78 L 182 44" className={`${s.dgold} ${s.dcheck}`} />
        <rect x="230" y="34" width="22" height="22" rx="5" className={s.dln} />
        <line x1="262" y1="45" x2="330" y2="45" className={s.dln} />
        <rect x="230" y="66" width="22" height="22" rx="5" className={s.dln} />
        <line x1="262" y1="77" x2="316" y2="77" className={s.dln} />
      </svg>
    </div>
  );
}

export function CrawlerGateArt({ label }: { label: string }) {
  return (
    <div className={s.artRow} role="img" aria-label={label}>
      <svg viewBox="0 0 440 130" xmlns="http://www.w3.org/2000/svg">
        <path d="M 196 30 L 176 30 L 176 100 L 196 100" className={s.dln} />
        <path d="M 244 30 L 264 30 L 264 100 L 244 100" className={s.dln} />
        <line x1="40" y1="65" x2="400" y2="65" className={`${s.dgold} ${s.dflow}`} />
        <circle cx="120" cy="65" r="5" className={s.dln} />
        <circle cx="90" cy="65" r="5" className={s.dln} />
        <circle cx="220" cy="65" r="5" className={`${s.dgoldFill} ${s.dpulse}`} style={{ transformOrigin: "220px 65px" }} />
        <circle cx="330" cy="65" r="5" className={s.dln} />
      </svg>
    </div>
  );
}

export function ReviewPulseArt({ label }: { label: string }) {
  return (
    <div className={s.artRow} role="img" aria-label={label}>
      <svg viewBox="0 0 440 130" xmlns="http://www.w3.org/2000/svg">
        <line x1="30" y1="96" x2="410" y2="96" className={s.dln} />
        <path d="M 30 96 L 120 96 L 160 60 L 200 96 L 250 96 L 292 40 L 330 96 L 410 96" className={`${s.dgold} ${s.ddraw}`} />
        <path d="M 292 20 l 2.6 5.8 6.3 .5 -4.8 4.2 1.5 6.2 -5.6 -3.3 -5.6 3.3 1.5 -6.2 -4.8 -4.2 6.3 -.5 Z" className={`${s.dgoldFill} ${s.dpulse}`} style={{ transformOrigin: "292px 28px" }} />
      </svg>
    </div>
  );
}
// EOF-guide-art
