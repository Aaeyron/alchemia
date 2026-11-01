import { emojiFor } from "@/lib/emoji";
import type { PhotoBox } from "@/lib/types";

// Pastel colors for the boxes, cycled by object (border, see-through fill, label).
const COLORS = [
  { border: "border-pink", fill: "bg-pink/20", label: "bg-pink" },
  { border: "border-sky", fill: "bg-sky/20", label: "bg-sky" },
  { border: "border-sunny", fill: "bg-sunny/20", label: "bg-sunny" },
  { border: "border-mint", fill: "bg-mint/20", label: "bg-mint" },
  { border: "border-lavender", fill: "bg-lavender/20", label: "bg-lavender" },
];

type PhotoBoxesProps = {
  photo: string;
  // id = the ingredient the box belongs to; colorIndex picks its pastel color
  boxes: { box: PhotoBox; id: string; colorIndex: number }[];
  selected: string[]; // selected ingredient ids
  onToggle: (id: string) => void;
  // Set when a chip is tapped, so its box does a little pop. `count` changes on every tap.
  flash: { id: string; count: number } | null;
};

// The uploaded photo in its polaroid frame, with tappable boxes around the objects SAM found.
export function PhotoBoxes({ photo, boxes, selected, onToggle, flash }: PhotoBoxesProps) {
  // Draw big boxes first so smaller ones sit on top and stay tappable.
  const ordered = [...boxes].sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);

  return (
    <div className="sticker relative mx-auto mt-3 w-full max-w-md rotate-1 bg-white p-3 pb-4">
      {/* Two strips of washi tape hold the photo onto the page. */}
      <span aria-hidden="true" className="washi tape-sunny -top-3 -left-2 -rotate-12" />
      <span aria-hidden="true" className="washi tape-lavender -top-3 -right-2 rotate-12" />
      {/* This wrapper is exactly the size of the picture, so the % positions line up with it.
          overflow-hidden keeps boxes and labels inside the photo. */}
      <div className="relative mx-auto w-fit overflow-hidden rounded-control">
        {/* A plain <img> is fine here: the source is a local data URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="Your uploaded photo" className="block max-h-80 max-w-full" />

        {ordered.map(({ box, id, colorIndex }) => {
          const color = COLORS[colorIndex % COLORS.length];
          const isSelected = selected.includes(id);
          // A new key on every chip tap re-mounts the box, which replays the pop animation.
          const flashCount = flash?.id === id ? flash.count : 0;

          return (
            <button
              key={`${id}-${flashCount}`}
              type="button"
              onClick={() => onToggle(id)}
              aria-pressed={isSelected}
              aria-label={`${box.name}: ${isSelected ? "in the cauldron" : "tap to add"}`}
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.w * 100}%`,
                height: `${box.h * 100}%`,
              }}
              className={`absolute cursor-pointer rounded-lg ${color.fill} ${
                isSelected ? "border-4 border-ink" : `border-thick ${color.border}`
              } ${flashCount > 0 ? "pop" : ""}`}
            >
              <span
                className={`absolute top-1 left-1 rounded-full border-thin border-ink px-2 text-xs font-semibold whitespace-nowrap text-ink ${color.label}`}
              >
                {isSelected && "✓ "}
                {emojiFor(box.name)} {box.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
