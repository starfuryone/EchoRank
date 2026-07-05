import a from "./hero-art.module.css";

export function VisibilityArt() {
  return (
    <svg viewBox="0 0 320 240" className={a.art} xmlns="http://www.w3.org/2000/svg">
      <circle cx="160" cy="120" r="40" className={a.lnFaint} />
      <circle cx="160" cy="120" r="70" className={a.lnFaint} />
      <circle cx="160" cy="120" r="100" className={a.ln} />
      <line x1="160" y1="14" x2="160" y2="26" className={a.lnFaint} />
      <line x1="160" y1="214" x2="160" y2="226" className={a.lnFaint} />
      <line x1="54" y1="120" x2="66" y2="120" className={a.lnFaint} />
      <line x1="254" y1="120" x2="266" y2="120" className={a.lnFaint} />
      <g className={a.sweep}>
        <line x1="160" y1="120" x2="160" y2="22" className={a.gold} />
      </g>
      <circle cx="215" cy="85" r="4" className={a.goldFill} />
      <circle cx="215" cy="85" r="18" className={`${a.gold} ${a.ping}`} />
    </svg>
  );
}

export function RiskArt() {
  return (
    <svg viewBox="0 0 320 240" className={a.art} xmlns="http://www.w3.org/2000/svg">
      <path d="M 82.06 195 A 90 90 0 1 1 237.94 195" className={a.ln} />
      <path d="M 82.06 195 A 90 90 0 0 1 129.2 65.43" className={a.gold} />
      <line x1="82.06" y1="195" x2="89" y2="191" className={a.lnFaint} />
      <line x1="160" y1="60" x2="160" y2="68" className={a.lnFaint} />
      <line x1="237.94" y1="195" x2="231" y2="191" className={a.lnFaint} />
      <g className={a.needle}>
        <line x1="160" y1="150" x2="160" y2="76" className={a.gold} />
      </g>
      <circle cx="160" cy="150" r="4" className={a.goldFill} />
    </svg>
  );
}

export function FeedbackArt() {
  return (
    <svg viewBox="0 0 320 240" className={a.art} xmlns="http://www.w3.org/2000/svg">
      <g className={a.b1}>
        <rect x="46" y="42" width="150" height="40" rx="9" className={a.ln} />
        <line x1="62" y1="58" x2="170" y2="58" className={a.lnFaint} />
        <line x1="62" y1="68" x2="140" y2="68" className={a.lnFaint} />
      </g>
      <g className={a.b2}>
        <rect x="124" y="98" width="150" height="40" rx="9" className={a.gold} />
        <line x1="140" y1="114" x2="240" y2="114" className={a.lnFaint} />
        <line x1="140" y1="124" x2="214" y2="124" className={a.lnFaint} />
      </g>
      <g className={a.b3}>
        <rect x="46" y="154" width="150" height="40" rx="9" className={a.ln} />
        <line x1="62" y1="170" x2="170" y2="170" className={a.lnFaint} />
        <line x1="62" y1="180" x2="150" y2="180" className={a.lnFaint} />
      </g>
      <g className={a.star}>
        <path
          d="M 254 100 l 2.4 5.4 5.9 .5 -4.5 3.9 1.4 5.8 -5.2 -3.1 -5.2 3.1 1.4 -5.8 -4.5 -3.9 5.9 -.5 Z"
          className={a.goldFill}
        />
      </g>
    </svg>
  );
}

export function EngineArt() {
  return (
    <svg viewBox="0 0 320 240" className={a.art} xmlns="http://www.w3.org/2000/svg">
      <circle cx="160" cy="115" r="80" className={`${a.gold} ${a.flow}`} />
      <circle cx="160" cy="115" r="52" className={a.lnFaint} />
      <circle cx="160" cy="35" r="5" className={a.ln} />
      <circle cx="90.7" cy="155" r="5" className={a.ln} />
      <circle cx="229.3" cy="155" r="5" className={a.goldFill} />
      <circle cx="160" cy="115" r="7" className={`${a.goldFill} ${a.hub}`} />
    </svg>
  );
}
// EOF-hero-art

export function StepsArt() {
  return (
    <svg viewBox="0 0 320 240" className={a.art} xmlns="http://www.w3.org/2000/svg">
      <path d="M 56 178 C 110 178, 110 62, 164 62 C 218 62, 218 178, 264 178" className={`${a.gold} ${a.flow}`} />
      <circle cx="56" cy="178" r="10" className={a.ln} />
      <circle cx="164" cy="62" r="10" className={a.ln} />
      <circle cx="264" cy="178" r="10" className={`${a.goldFill} ${a.hub}`} />
      <line x1="40" y1="206" x2="88" y2="206" className={a.lnFaint} />
      <line x1="140" y1="34" x2="188" y2="34" className={a.lnFaint} />
      <line x1="240" y1="206" x2="288" y2="206" className={a.lnFaint} />
    </svg>
  );
}

export function MonitorArt() {
  return (
    <svg viewBox="0 0 320 240" className={a.art} xmlns="http://www.w3.org/2000/svg">
      <line x1="36" y1="150" x2="284" y2="150" className={a.lnFaint} />
      <line x1="36" y1="60" x2="36" y2="184" className={a.lnFaint} />
      <path
        d="M 36 150 L 92 150 L 112 128 L 132 150 L 158 150 L 178 96 L 198 168 L 218 150 L 284 150"
        className={`${a.gold} ${a.draw}`}
      />
      <circle cx="178" cy="96" r="4" className={`${a.goldFill} ${a.peak}`} />
      <circle cx="284" cy="150" r="3" className={a.ln} />
    </svg>
  );
}

export function ActArt() {
  return (
    <svg viewBox="0 0 320 240" className={a.art} xmlns="http://www.w3.org/2000/svg">
      <circle cx="86" cy="118" r="26" className={a.ln} />
      <path d="M 78 126 a 10 10 0 0 1 16 0 M 86 104 v 4" className={a.ln} />
      <circle cx="86" cy="118" r="40" className={`${a.gold} ${a.ping}`} style={{ transformOrigin: "86px 118px" }} />
      <line x1="126" y1="118" x2="188" y2="118" className={`${a.gold} ${a.flow}`} />
      <path d="M 182 110 L 192 118 L 182 126" className={a.gold} />
      <circle cx="234" cy="118" r="26" className={a.ln} />
      <path d="M 222 118 L 231 127 L 247 108" className={`${a.gold} ${a.check}`} />
    </svg>
  );
}
