// A pastel "sticker" card. Pass `index` (0, 1, 2, ...) and each card gets its own
// color and a slightly different tilt — made for the 3 idea cards.

const COLORS = ["bg-pink-soft", "bg-sky-soft", "bg-mint-soft", "bg-sunny-soft", "bg-lavender-soft"];
const TILTS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2"];

type StickerCardProps = {
  index?: number;
  emoji?: string;
  title: string;
  children: React.ReactNode;
};

export function StickerCard({ index = 0, emoji, title, children }: StickerCardProps) {
  const color = COLORS[index % COLORS.length];
  const tilt = TILTS[index % TILTS.length];

  return (
    <article className={`sticker ${color} ${tilt} p-5 transition-transform hover:rotate-0`}>
      <h3 className="mb-2 flex items-center gap-2 text-xl font-semibold">
        {emoji && <span aria-hidden="true">{emoji}</span>}
        {title}
      </h3>
      <div className="text-base leading-relaxed">{children}</div>
    </article>
  );
}
