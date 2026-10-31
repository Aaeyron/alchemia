// "Bubbles", Alchemia's original cauldron mascot, drawn with inline SVG.
// It blinks every few seconds, and bobs with rising bubbles while `bubbling` is true.
// Animations are defined in globals.css (and switched off for reduced-motion users).

const INK = "#3b2f4a";

type MascotProps = {
  size?: number;
  bubbling?: boolean;
};

export function Mascot({ size = 112, bubbling = false }: MascotProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label="Bubbles, the smiling cauldron"
      className={bubbling ? "mascot-bobbing" : undefined}
    >
      {/* Bubbles floating out of the pot */}
      <g fill="#fff" stroke={INK} strokeWidth="3">
        <circle className="mascot-bubble" cx="44" cy="28" r="5" />
        <circle className="mascot-bubble" cx="66" cy="18" r="7" style={{ animationDelay: "0.4s" }} />
        <circle className="mascot-bubble" cx="84" cy="30" r="4" style={{ animationDelay: "0.8s" }} />
      </g>

      {/* Little feet */}
      <ellipse cx="38" cy="108" rx="11" ry="6" fill={INK} />
      <ellipse cx="82" cy="108" rx="11" ry="6" fill={INK} />

      {/* Pot body */}
      <path
        d="M18 52 Q14 106 60 106 Q106 106 102 52 Z"
        fill="#b9a3f5"
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* Minty potion peeking over the rim */}
      <ellipse cx="60" cy="45" rx="40" ry="8" fill="#6fdcb4" stroke={INK} strokeWidth="4" />

      {/* Rim */}
      <rect x="10" y="44" width="100" height="14" rx="7" fill="#9b84ea" stroke={INK} strokeWidth="4" />

      {/* Eyes (with sparkly highlights) — this group blinks */}
      <g className="mascot-eyes">
        <ellipse cx="46" cy="74" rx="5" ry="7" fill={INK} />
        <ellipse cx="74" cy="74" rx="5" ry="7" fill={INK} />
        <circle cx="47.5" cy="71" r="2" fill="#fff" />
        <circle cx="75.5" cy="71" r="2" fill="#fff" />
      </g>

      {/* Rosy cheeks */}
      <ellipse cx="34" cy="86" rx="7" ry="4" fill="#ff8fb8" opacity="0.8" />
      <ellipse cx="86" cy="86" rx="7" ry="4" fill="#ff8fb8" opacity="0.8" />

      {/* Smile */}
      <path d="M50 86 Q60 96 70 86" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
