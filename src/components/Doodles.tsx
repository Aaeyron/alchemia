// Little hand-drawn doodles (original inline SVG), used sparingly as decoration.
// All are hidden from screen readers.

const INK = "#3b2f4a";
const GRAPHITE = "#5b5466";

type DoodleProps = { className?: string };

// A wobbly marker squiggle, e.g. under a step heading.
export function Squiggle({ className = "" }: DoodleProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 12" className={className} fill="none">
      <path
        d="M2 7 C 12 2, 20 11, 30 6 S 48 2, 58 7 S 76 11, 86 6 S 104 2, 118 6"
        stroke="#ff8fb8"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// A pencil line, a little uneven, like someone underlined the word by hand.
export function PencilUnderline({ className = "" }: DoodleProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 60 8" className={className} fill="none" preserveAspectRatio="none">
      <path d="M2 5 Q 16 2.5 30 4.5 T 58 3.5" stroke={GRAPHITE} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8 6.5 Q 26 5 50 5.5" stroke={GRAPHITE} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

// A gold star sticker with slightly uneven points.
export function StarSticker({ className = "" }: DoodleProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path
        d="M12 1.5 L14.6 8.4 L22 8.8 L16.2 13.4 L18.2 20.6 L12 16.4 L5.9 20.4 L7.9 13.3 L2.2 8.9 L9.5 8.6 Z"
        fill="#ffd23f"
        stroke={INK}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.6 9.8 L11 8.9" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// Three tiny outlined stars, e.g. next to the title.
export function TinyStars({ className = "" }: DoodleProps) {
  const star = "M0 -5 L1.3 -1.4 L5 -1.2 L2 1.1 L3 5 L0 2.8 L-3 5 L-2 1.1 L-5 -1.2 L-1.3 -1.4 Z";
  return (
    <svg aria-hidden="true" viewBox="0 0 44 30" className={className} fill="none" stroke={INK} strokeWidth="1.5" strokeLinejoin="round">
      <path d={star} transform="translate(8 20) rotate(-10)" fill="#b9a3f5" />
      <path d={star} transform="translate(24 8) rotate(12) scale(1.2)" fill="#ffd23f" />
      <path d={star} transform="translate(37 22) scale(0.8)" fill="#7cc6fe" />
    </svg>
  );
}

// A bent-wire paper clip.
export function PaperClip({ className = "" }: DoodleProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 56" className={className} fill="none">
      <path
        d="M16 14 V42 a6 6 0 0 1 -12 0 V10 a8 8 0 0 1 16 0 V44 a10 10 0 0 1 -20 0 V18"
        transform="translate(2 2)"
        stroke="#8f9bb0"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// A yellow pencil with a pink eraser.
export function Pencil({ className = "" }: DoodleProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 16" className={className} stroke={INK} strokeWidth="1.8" strokeLinejoin="round">
      <rect x="10" y="3" width="40" height="10" fill="#ffd23f" />
      <rect x="50" y="3" width="10" height="10" rx="2" fill="#ff8fb8" />
      <path d="M10 3 L2 8 L10 13 Z" fill="#f6e0b8" />
      <path d="M4.5 6.5 L2 8 L4.5 9.5 Z" fill={INK} />
      <path d="M12 8 H48" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}
