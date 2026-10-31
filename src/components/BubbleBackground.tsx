// "Bubbly Sky" page background: a soft gradient with floating bubbles and twinkling sparkles.
// Rendered once in layout.tsx. It sits in a fixed, full-screen layer behind all content
// and ignores taps. Styles and animations live in globals.css (.sky, .bubble, .sparkle).

// Bubble tints, cycled in order (see .bubble-pink etc. in globals.css).
const TINTS = ["bubble-pink", "bubble-sky", "bubble-sunny", "bubble-mint", "bubble-lavender"];

// Each bubble: horizontal position (%), resting height (%), size (px),
// seconds per trip, and a negative delay so they start spread out instead of all at once.
const BUBBLES = [
  { left: 3, top: 60, size: 54, duration: 34, delay: -4 },
  { left: 12, top: 35, size: 22, duration: 25, delay: -14 },
  { left: 19, top: 68, size: 88, duration: 42, delay: -26 },
  { left: 28, top: 45, size: 34, duration: 29, delay: -8 },
  { left: 36, top: 55, size: 18, duration: 22, delay: -18 },
  { left: 44, top: 40, size: 66, duration: 38, delay: -31 },
  { left: 52, top: 64, size: 28, duration: 27, delay: -3 },
  { left: 60, top: 50, size: 46, duration: 33, delay: -22 },
  { left: 68, top: 32, size: 20, duration: 24, delay: -12 },
  { left: 75, top: 60, size: 96, duration: 44, delay: -35 },
  { left: 84, top: 42, size: 30, duration: 26, delay: -6 },
  { left: 91, top: 55, size: 58, duration: 36, delay: -20 },
  { left: 15, top: 48, size: 40, duration: 31, delay: -24 },
  { left: 88, top: 68, size: 16, duration: 21, delay: -10 },
];

// Sparkle colors: a fill plus a slightly deeper outline so they stand out on the pale sky.
const YELLOW = { fill: "#ffd23f", stroke: "#e8b100" };
const WHITE = { fill: "#ffffff", stroke: "#c4b2f7" };

// Each sparkle: position (%), size (px), color, and twinkle delay (s).
const SPARKLES = [
  { left: 8, top: 14, size: 22, color: YELLOW, delay: 0 },
  { left: 30, top: 8, size: 16, color: WHITE, delay: 1.2 },
  { left: 58, top: 18, size: 20, color: YELLOW, delay: 2.4 },
  { left: 86, top: 10, size: 24, color: WHITE, delay: 0.6 },
  { left: 94, top: 38, size: 16, color: YELLOW, delay: 3.1 },
  { left: 5, top: 46, size: 18, color: WHITE, delay: 1.8 },
  { left: 72, top: 82, size: 20, color: YELLOW, delay: 2.8 },
];

export function BubbleBackground() {
  return (
    <div aria-hidden="true" className="sky">
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className={`bubble ${TINTS[i % TINTS.length]}`}
          style={{
            left: `${b.left}%`,
            top: `${b.top}%`,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}

      {SPARKLES.map((s, i) => (
        <svg
          key={i}
          className="sparkle"
          viewBox="0 0 24 24"
          width={s.size}
          height={s.size}
          style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s` }}
        >
          {/* Four-point star */}
          <path
            d="M12 1 C13 8 16 11 23 12 C16 13 13 16 12 23 C11 16 8 13 1 12 C8 11 11 8 12 1 Z"
            fill={s.color.fill}
            stroke={s.color.stroke}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </div>
  );
}
