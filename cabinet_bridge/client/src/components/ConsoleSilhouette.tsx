/**
 * Stylised SVG silhouettes, one per system.
 * All use viewBox="0 0 200 120", white fills, semi-transparent —
 * designed to sit as a watermark inside the SystemTile gradient.
 */

const S = 0.28; // base silhouette opacity

export function ConsoleSilhouette({ systemId }: { systemId: string }) {
  switch (systemId) {
    case "nes":       return <NES />;
    case "snes":      return <SNES />;
    case "n64":       return <N64 />;
    case "gba":       return <GBA />;
    case "genesis":   return <Genesis />;
    case "ps1":       return <PS1 />;
    case "ps2":       return <PS2 />;
    case "arcade":    return <Arcade />;
    case "dreamcast": return <Dreamcast />;
    case "gb":        return <GameBoy />;
    case "gbc":       return <GameBoyColor />;
    case "nds":       return <NDS />;
    case "psp":       return <PSP />;
    case "atari2600": return <Atari2600 />;
    case "saturn":    return <Saturn />;
    case "gamegear":  return <GameGear />;
    case "sms":       return <MasterSystem />;
    case "pce":       return <PCEngine />;
    default:          return null;
  }
}

const svgProps = {
  className: "absolute inset-0 w-full h-full",
  viewBox: "0 0 200 120",
  preserveAspectRatio: "xMidYMid meet",
  "aria-hidden": true as const,
};

/* ── NES controller ─────────────────────────────────────────────────── */
function NES() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Body */}
        <rect x="18" y="32" width="164" height="56" rx="28" />
        {/* D-pad horizontal */}
        <rect x="46" y="54" width="32" height="12" rx="3" fill="black" opacity="0.4" />
        <rect x="46" y="54" width="32" height="12" rx="3" />
        {/* D-pad vertical */}
        <rect x="58" y="42" width="12" height="36" rx="3" fill="black" opacity="0.4" />
        <rect x="58" y="42" width="12" height="36" rx="3" />
        {/* Select / Start */}
        <ellipse cx="89" cy="64" rx="9" ry="6" opacity="0.7" />
        <ellipse cx="111" cy="64" rx="9" ry="6" opacity="0.7" />
        {/* B */}
        <circle cx="133" cy="68" r="10" opacity="0.85" />
        {/* A */}
        <circle cx="153" cy="56" r="10" opacity="0.85" />
      </g>
    </svg>
  );
}

/* ── SNES controller ────────────────────────────────────────────────── */
function SNES() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Shoulder L */}
        <rect x="18" y="16" width="44" height="14" rx="7" />
        {/* Shoulder R */}
        <rect x="138" y="16" width="44" height="14" rx="7" />
        {/* Body */}
        <path d="M22,30 Q22,22 32,22 L168,22 Q178,22 178,30 L178,78 Q178,94 162,98 L148,104 Q136,108 128,100 L100,88 L72,100 Q64,108 52,104 L38,98 Q22,94 22,78 Z" />
        {/* D-pad h */}
        <rect x="44" y="54" width="30" height="10" rx="3" fill="black" opacity="0.3" />
        <rect x="44" y="54" width="30" height="10" rx="3" />
        {/* D-pad v */}
        <rect x="55" y="43" width="10" height="30" rx="3" fill="black" opacity="0.3" />
        <rect x="55" y="43" width="10" height="30" rx="3" />
        {/* Select / Start */}
        <ellipse cx="90" cy="64" rx="8" ry="5" opacity="0.7" />
        <ellipse cx="110" cy="64" rx="8" ry="5" opacity="0.7" />
        {/* X */}
        <circle cx="144" cy="46" r="8" opacity="0.85" />
        {/* Y */}
        <circle cx="130" cy="59" r="8" opacity="0.85" />
        {/* A */}
        <circle cx="158" cy="59" r="8" opacity="0.85" />
        {/* B */}
        <circle cx="144" cy="72" r="8" opacity="0.85" />
      </g>
    </svg>
  );
}

/* ── N64 controller ─────────────────────────────────────────────────── */
function N64() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Left prong */}
        <path d="M18,30 Q18,22 26,22 L60,22 Q68,22 68,30 L68,86 Q68,96 58,96 L28,96 Q18,96 18,86 Z" />
        {/* Center prong */}
        <path d="M76,30 Q76,22 84,22 L116,22 Q124,22 124,30 L124,88 Q124,98 114,98 L86,98 Q76,98 76,88 Z" />
        {/* Right prong */}
        <path d="M132,30 Q132,22 140,22 L174,22 Q182,22 182,30 L182,86 Q182,96 172,96 L142,96 Q132,96 132,86 Z" />
        {/* Connecting bridge */}
        <rect x="18" y="22" width="164" height="28" rx="4" />
        {/* D-pad on left prong */}
        <rect x="30" y="52" width="26" height="8" rx="2" fill="black" opacity="0.3" />
        <rect x="30" y="52" width="26" height="8" rx="2" />
        <rect x="40" y="42" width="8" height="26" rx="2" fill="black" opacity="0.3" />
        <rect x="40" y="42" width="8" height="26" rx="2" />
        {/* Analog stick on center */}
        <circle cx="100" cy="52" r="10" opacity="0.85" />
        {/* A button */}
        <circle cx="100" cy="78" r="8" opacity="0.85" />
        {/* C buttons on right prong */}
        <circle cx="150" cy="44" r="7" opacity="0.75" />
        <circle cx="163" cy="56" r="7" opacity="0.75" />
        <circle cx="150" cy="68" r="7" opacity="0.75" />
        <circle cx="137" cy="56" r="7" opacity="0.75" />
      </g>
    </svg>
  );
}

/* ── Game Boy Advance ───────────────────────────────────────────────── */
function GBA() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Body */}
        <rect x="14" y="22" width="172" height="76" rx="38" />
        {/* Screen bezel */}
        <rect x="52" y="32" width="96" height="56" rx="6" fill="black" opacity="0.35" />
        {/* L shoulder */}
        <rect x="14" y="14" width="38" height="14" rx="7" />
        {/* R shoulder */}
        <rect x="148" y="14" width="38" height="14" rx="7" />
        {/* D-pad h */}
        <rect x="22" y="54" width="28" height="10" rx="3" />
        {/* D-pad v */}
        <rect x="32" y="44" width="10" height="28" rx="3" />
        {/* B */}
        <circle cx="165" cy="64" r="9" opacity="0.85" />
        {/* A */}
        <circle cx="178" cy="52" r="9" opacity="0.85" />
        {/* Start/Select */}
        <ellipse cx="96" cy="83" rx="8" ry="5" opacity="0.7" />
        <ellipse cx="114" cy="83" rx="8" ry="5" opacity="0.7" />
      </g>
    </svg>
  );
}

/* ── Sega Genesis controller ────────────────────────────────────────── */
function Genesis() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Body */}
        <path d="M24,40 Q24,24 44,24 L156,24 Q176,24 176,40 L176,72 Q176,96 156,100 L124,104 Q108,110 100,104 Q92,110 76,104 L44,100 Q24,96 24,72 Z" />
        {/* D-pad h */}
        <rect x="38" y="55" width="30" height="10" rx="3" />
        {/* D-pad v */}
        <rect x="49" y="44" width="10" height="30" rx="3" />
        {/* A */}
        <circle cx="116" cy="66" r="10" opacity="0.85" />
        {/* B */}
        <circle cx="134" cy="58" r="10" opacity="0.85" />
        {/* C */}
        <circle cx="152" cy="66" r="10" opacity="0.85" />
        {/* Start */}
        <circle cx="100" cy="62" r="7" opacity="0.7" />
      </g>
    </svg>
  );
}

/* ── PS1 DualShock ──────────────────────────────────────────────────── */
function PS1() {
  return <DualShock />;
}

/* ── PS2 DualShock 2 ────────────────────────────────────────────────── */
function PS2() {
  return <DualShock />;
}

/* Shared DualShock shape (PS1 & PS2 look nearly identical) */
function DualShock() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Left handle */}
        <path d="M22,44 Q22,28 34,28 L72,28 L78,72 Q78,96 60,100 L38,100 Q18,100 18,80 Z" />
        {/* Right handle */}
        <path d="M128,28 L166,28 Q178,28 178,44 L182,80 Q182,100 162,100 L140,100 Q122,96 122,72 Z" />
        {/* Center bridge */}
        <path d="M68,24 L132,24 Q138,24 140,30 L144,50 Q144,56 138,56 L62,56 Q56,56 56,50 L60,30 Q62,24 68,24 Z" />
        {/* L1 */}
        <rect x="22" y="14" width="46" height="13" rx="6" />
        {/* R1 */}
        <rect x="132" y="14" width="46" height="13" rx="6" />
        {/* D-pad */}
        <rect x="38" y="38" width="28" height="9" rx="2" />
        <rect x="48" y="28" width="9" height="28" rx="2" />
        {/* △ □ × ○ */}
        <circle cx="148" cy="30" r="7" opacity="0.85" />
        <circle cx="136" cy="40" r="7" opacity="0.85" />
        <circle cx="160" cy="40" r="7" opacity="0.85" />
        <circle cx="148" cy="50" r="7" opacity="0.85" />
        {/* Analog sticks */}
        <circle cx="76" cy="64" r="11" />
        <circle cx="118" cy="64" r="11" />
        {/* Select / Start */}
        <rect x="88" y="38" width="10" height="7" rx="3" opacity="0.7" />
        <rect x="102" y="38" width="10" height="7" rx="3" opacity="0.7" />
      </g>
    </svg>
  );
}

/* ── Arcade cabinet ─────────────────────────────────────────────────── */
function Arcade() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Cabinet body */}
        <path d="M54,8 L146,8 Q154,8 156,16 L168,52 L168,114 Q168,118 164,118 L36,118 Q32,118 32,114 L32,52 L44,16 Q46,8 54,8 Z" />
        {/* Screen bezel */}
        <rect x="46" y="20" width="108" height="56" rx="4" fill="black" opacity="0.35" />
        {/* Marquee top */}
        <rect x="52" y="8" width="96" height="12" rx="2" opacity="0.5" fill="black" />
        {/* Control panel */}
        <rect x="36" y="80" width="128" height="32" rx="3" opacity="0.6" />
        {/* Joystick base */}
        <circle cx="76" cy="96" r="12" fill="black" opacity="0.3" />
        <circle cx="76" cy="96" r="12" opacity="0.5" />
        <circle cx="76" cy="90" r="5" />
        {/* Buttons */}
        <circle cx="112" cy="88" r="8" opacity="0.85" />
        <circle cx="128" cy="92" r="8" opacity="0.85" />
        <circle cx="144" cy="88" r="8" opacity="0.85" />
      </g>
    </svg>
  );
}

/* ── Dreamcast controller ───────────────────────────────────────────── */
function Dreamcast() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Body — distinctive circular center */}
        <path d="M30,48 Q30,28 52,24 L100,20 L148,24 Q170,28 170,48 L170,82 Q170,104 148,108 L52,108 Q30,104 30,82 Z" />
        {/* VMU slot (center top) */}
        <rect x="72" y="20" width="56" height="30" rx="4" fill="black" opacity="0.3" />
        {/* Analog thumb */}
        <circle cx="72" cy="72" r="14" opacity="0.85" />
        {/* D-pad */}
        <rect x="38" y="62" width="26" height="8" rx="2" />
        <rect x="47" y="53" width="8" height="26" rx="2" />
        {/* A / B / X / Y */}
        <circle cx="148" cy="58" r="9" opacity="0.85" />
        <circle cx="160" cy="70" r="9" opacity="0.85" />
        <circle cx="136" cy="70" r="9" opacity="0.85" />
        <circle cx="148" cy="82" r="9" opacity="0.85" />
        {/* Start */}
        <circle cx="100" cy="80" r="7" opacity="0.7" />
      </g>
    </svg>
  );
}

/* ── Original Game Boy ──────────────────────────────────────────────── */
function GameBoy() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Body */}
        <rect x="60" y="4" width="80" height="114" rx="12" />
        {/* Screen area */}
        <rect x="70" y="14" width="60" height="48" rx="4" fill="black" opacity="0.35" />
        {/* Speaker grille dots */}
        {[0,1,2,3].map(i => (
          <circle key={i} cx={134 + i * 4} cy={85} r="1.5" fill="black" opacity="0.3" />
        ))}
        {/* D-pad h */}
        <rect x="68" y="76" width="28" height="9" rx="2" />
        {/* D-pad v */}
        <rect x="77" y="67" width="9" height="26" rx="2" />
        {/* B */}
        <circle cx="118" cy="84" r="9" opacity="0.85" />
        {/* A */}
        <circle cx="133" cy="76" r="9" opacity="0.85" />
        {/* Select / Start */}
        <rect x="76" y="100" width="16" height="6" rx="3" opacity="0.7" />
        <rect x="108" y="100" width="16" height="6" rx="3" opacity="0.7" />
      </g>
    </svg>
  );
}

/* ── Game Boy Color ─────────────────────────────────────────────────── */
function GameBoyColor() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Body — slightly curvier than original GB */}
        <path d="M62,4 Q62,4 100,4 Q138,4 138,4 L138,88 Q138,116 100,116 Q62,116 62,88 Z" />
        {/* Screen */}
        <rect x="72" y="14" width="56" height="44" rx="4" fill="black" opacity="0.35" />
        {/* D-pad */}
        <rect x="68" y="74" width="28" height="9" rx="2" />
        <rect x="77" y="65" width="9" height="26" rx="2" />
        {/* B */}
        <circle cx="118" cy="82" r="9" opacity="0.85" />
        {/* A */}
        <circle cx="132" cy="74" r="9" opacity="0.85" />
        {/* Select / Start */}
        <rect x="76" y="97" width="14" height="6" rx="3" opacity="0.7" />
        <rect x="110" y="97" width="14" height="6" rx="3" opacity="0.7" />
      </g>
    </svg>
  );
}

/* ── Nintendo DS ────────────────────────────────────────────────────── */
function NDS() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Top shell */}
        <rect x="26" y="4" width="148" height="52" rx="10" />
        {/* Top screen */}
        <rect x="38" y="10" width="124" height="40" rx="4" fill="black" opacity="0.35" />
        {/* Hinge */}
        <rect x="26" y="54" width="148" height="8" rx="2" opacity="0.5" />
        {/* Bottom shell */}
        <rect x="26" y="60" width="148" height="56" rx="10" />
        {/* Bottom screen */}
        <rect x="62" y="66" width="76" height="42" rx="3" fill="black" opacity="0.35" />
        {/* D-pad */}
        <rect x="30" y="76" width="24" height="8" rx="2" />
        <rect x="38" y="68" width="8" height="24" rx="2" />
        {/* A/B/X/Y */}
        <circle cx="156" cy="74" r="6" opacity="0.85" />
        <circle cx="146" cy="82" r="6" opacity="0.85" />
        <circle cx="166" cy="82" r="6" opacity="0.85" />
        <circle cx="156" cy="90" r="6" opacity="0.85" />
        {/* Start */}
        <circle cx="100" cy="106" r="5" opacity="0.7" />
      </g>
    </svg>
  );
}

/* ── PSP ────────────────────────────────────────────────────────────── */
function PSP() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Body */}
        <rect x="10" y="24" width="180" height="72" rx="36" />
        {/* Screen */}
        <rect x="48" y="32" width="104" height="56" rx="4" fill="black" opacity="0.35" />
        {/* Analog nub */}
        <circle cx="28" cy="42" r="10" opacity="0.85" />
        {/* D-pad */}
        <rect x="14" y="70" width="22" height="7" rx="2" />
        <rect x="19" y="63" width="7" height="22" rx="2" />
        {/* △ □ × ○ */}
        <circle cx="166" cy="42" r="7" opacity="0.85" />
        <circle cx="156" cy="52" r="7" opacity="0.85" />
        <circle cx="176" cy="52" r="7" opacity="0.85" />
        <circle cx="166" cy="62" r="7" opacity="0.85" />
        {/* L trigger */}
        <rect x="10" y="16" width="40" height="12" rx="6" />
        {/* R trigger */}
        <rect x="150" y="16" width="40" height="12" rx="6" />
        {/* Home button */}
        <circle cx="100" cy="84" r="5" opacity="0.7" />
      </g>
    </svg>
  );
}

/* ── Atari 2600 ──────────────────────────────────────────────────────── */
function Atari2600() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Cartridge slot ridge */}
        <rect x="70" y="8" width="60" height="18" rx="4" />
        {/* Main body */}
        <rect x="20" y="22" width="160" height="70" rx="6" />
        {/* Faceplate recess */}
        <rect x="30" y="28" width="140" height="54" rx="4" fill="black" opacity="0.25" />
        {/* Difficulty switches */}
        <rect x="34" y="34" width="8" height="14" rx="3" />
        <rect x="48" y="34" width="8" height="14" rx="3" />
        {/* TV type & reset */}
        <rect x="138" y="34" width="8" height="14" rx="3" />
        <rect x="152" y="34" width="8" height="14" rx="3" />
        {/* Select / Reset labels row */}
        <rect x="80" y="38" width="18" height="6" rx="2" opacity="0.6" />
        <rect x="104" y="38" width="18" height="6" rx="2" opacity="0.6" />
        {/* Joystick port notches */}
        <rect x="70" y="84" width="20" height="8" rx="2" />
        <rect x="110" y="84" width="20" height="8" rx="2" />
      </g>
    </svg>
  );
}

/* ── Sega Saturn ─────────────────────────────────────────────────────── */
function Saturn() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Main body */}
        <rect x="15" y="18" width="170" height="78" rx="8" />
        {/* CD lid */}
        <rect x="25" y="22" width="110" height="50" rx="6" fill="black" opacity="0.3" />
        <ellipse cx="80" cy="47" rx="42" ry="20" fill="black" opacity="0.2" />
        {/* Lid open button */}
        <rect x="140" y="30" width="10" height="10" rx="2" opacity="0.7" />
        {/* Front face buttons */}
        <circle cx="148" cy="82" r="7" opacity="0.85" />
        <circle cx="162" cy="75" r="7" opacity="0.85" />
        <circle cx="162" cy="89" r="7" opacity="0.85" />
        <circle cx="176" cy="82" r="7" opacity="0.85" />
        {/* D-pad */}
        <rect x="24" y="77" width="24" height="7" rx="2" />
        <rect x="31" y="70" width="7" height="22" rx="2" />
        {/* Power / reset */}
        <circle cx="100" cy="84" r="5" opacity="0.6" />
        <circle cx="114" cy="84" r="4" opacity="0.5" />
      </g>
    </svg>
  );
}

/* ── Sega Game Gear ──────────────────────────────────────────────────── */
function GameGear() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Body */}
        <rect x="10" y="20" width="180" height="80" rx="20" />
        {/* Screen bezel */}
        <rect x="52" y="28" width="96" height="60" rx="6" fill="black" opacity="0.35" />
        {/* Screen */}
        <rect x="58" y="34" width="84" height="48" rx="4" fill="black" opacity="0.2" />
        {/* D-pad */}
        <rect x="16" y="64" width="30" height="8" rx="3" />
        <rect x="25" y="55" width="8" height="26" rx="3" />
        {/* Buttons (1, 2, start) */}
        <circle cx="158" cy="60" r="9" opacity="0.85" />
        <circle cx="174" cy="60" r="9" opacity="0.85" />
        <rect x="158" y="78" width="22" height="7" rx="3" opacity="0.7" />
        {/* Speaker dots */}
        <circle cx="20" cy="38" r="3" opacity="0.5" />
        <circle cx="28" cy="38" r="3" opacity="0.5" />
        <circle cx="20" cy="46" r="3" opacity="0.5" />
        <circle cx="28" cy="46" r="3" opacity="0.5" />
      </g>
    </svg>
  );
}

/* ── Sega Master System ──────────────────────────────────────────────── */
function MasterSystem() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Main body */}
        <rect x="10" y="25" width="180" height="68" rx="4" />
        {/* Cartridge slot */}
        <rect x="30" y="22" width="60" height="8" rx="2" />
        {/* Card slot */}
        <rect x="100" y="22" width="36" height="8" rx="2" />
        {/* Faceplate */}
        <rect x="18" y="32" width="100" height="52" rx="3" fill="black" opacity="0.25" />
        {/* Power LED */}
        <circle cx="130" cy="44" r="5" opacity="0.8" />
        {/* Reset button */}
        <rect x="126" y="60" width="12" height="10" rx="3" opacity="0.7" />
        {/* Port 1 */}
        <rect x="148" y="38" width="24" height="16" rx="3" />
        {/* Port 2 */}
        <rect x="148" y="62" width="24" height="16" rx="3" />
        {/* Red stripe accent */}
        <rect x="18" y="64" width="100" height="8" rx="0" opacity="0.4" />
      </g>
    </svg>
  );
}

/* ── TurboGrafx-16 / PC Engine ───────────────────────────────────────── */
function PCEngine() {
  return (
    <svg {...svgProps}>
      <g opacity={S} fill="white">
        {/* Compact square body */}
        <rect x="50" y="10" width="100" height="100" rx="8" />
        {/* HuCard slot top */}
        <rect x="62" y="6" width="76" height="8" rx="3" />
        {/* Faceplate */}
        <rect x="56" y="16" width="88" height="72" rx="5" fill="black" opacity="0.25" />
        {/* Run / Select buttons */}
        <circle cx="82" cy="96" r="6" opacity="0.8" />
        <circle cx="100" cy="96" r="6" opacity="0.8" />
        <circle cx="118" cy="96" r="6" opacity="0.8" />
        {/* Power light */}
        <circle cx="136" cy="24" r="4" opacity="0.7" />
        {/* Speaker grille dots */}
        <circle cx="64" cy="80" r="2.5" opacity="0.5" />
        <circle cx="72" cy="80" r="2.5" opacity="0.5" />
        <circle cx="64" cy="88" r="2.5" opacity="0.5" />
        <circle cx="72" cy="88" r="2.5" opacity="0.5" />
        {/* Controller port */}
        <rect x="62" y="104" width="76" height="6" rx="2" />
      </g>
    </svg>
  );
}
