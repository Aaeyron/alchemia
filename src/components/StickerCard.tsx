// The one panel / card look of the app: thick ink border, rounded corners, sticker shadow,
// the same padding and spacing inside, and the same heading size. Styles: .panel in globals.css.

// Background per tone. "paper" is the ruled notebook page (idea cards, build steps).
const TONES = {
  white: "bg-white",
  paper: "paper",
  pink: "bg-pink-soft",
  sky: "bg-sky-soft",
  mint: "bg-mint-soft",
  sunny: "bg-sunny-soft",
  lavender: "bg-lavender-soft",
};
export type CardTone = keyof typeof TONES;

const TILTS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2"];

type StickerCardProps = {
  tone?: CardTone;
  index?: number; // set for a row of cards (the 3 ideas): each gets a slightly different tilt
  emoji?: string;
  title?: string;
  headingLevel?: "h3" | "h4";
  as?: "section" | "article" | "div";
  className?: string;
  children: React.ReactNode;
};

export function StickerCard({
  tone = "white",
  index,
  emoji,
  title,
  headingLevel = "h3",
  as: Tag = "section",
  className = "",
  children,
}: StickerCardProps) {
  const Heading = headingLevel;
  const tilt = index === undefined ? "" : `${TILTS[index % TILTS.length]} transition-transform hover:rotate-0`;

  return (
    <Tag className={`panel ${TONES[tone]} ${tilt} ${className}`}>
      {title && (
        <Heading className="h-panel">
          {emoji && <span aria-hidden="true">{emoji}</span>}
          {title}
        </Heading>
      )}
      {children}
    </Tag>
  );
}
