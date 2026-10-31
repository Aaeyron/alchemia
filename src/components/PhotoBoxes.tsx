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
  boxes: { box: PhotoBox; index: number }[]; // index = which detected object it belongs to
  selected: number[];
  onToggle: (index: number) => void;
  // Set when a chip is tapped, so its box does a little pop. `count` changes on every tap.
  flash: { index: number; count: number } | null;
};

// The uploaded photo in its polaroid frame, with tappable boxes around the objects SAM found.
export function PhotoBoxes({ photo, boxes, selected, onToggle, flash }: PhotoBoxesProps) {
  // Draw big boxes first so smaller ones sit on top and stay tappable.
  const ordered = [...boxes].sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);

  return (
    <div className="sticker mx-auto w-full max-w-md rotate-1 bg-white p-3 pb-4">
      {/* This wrapper is exactly the size of the picture, so the % positions line up with it.
          overflow-hidden keeps boxes and labels inside the photo. */}
      <div className="relative mx-auto w-fit overflow-hidden rounded-xl">
        {/* A plain <img> is fine here: the source is a local data URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="Your uploaded photo" className="block max-h-80 max-w-full" />

        {ordered.map(({ box, index }) => {
          const color = COLORS[index % COLORS.length];
          const isSelected = selected.includes(index);
          // A new key on every chip tap re-mounts the box, which replays the pop animation.
          const flashCount = flash?.index === index ? flash.count : 0;

          return (
            <button
              key={`${index}-${flashCount}`}
              type="button"
              onClick={() => onToggle(index)}
              aria-pressed={isSelected}
              aria-label={`${box.name}: ${isSelected ? "in the cauldron" : "tap to add"}`}
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.w * 100}%`,
                height: `${box.h * 100}%`,
              }}
              className={`absolute cursor-pointer rounded-lg ${color.fill} ${
                isSelected ? "border-4 border-ink" : `border-[3px] ${color.border}`
              } ${flashCount > 0 ? "pop" : ""} focus-visible:outline-4 focus-visible:outline-ink`}
            >
              <span
                className={`absolute left-1 top-1 whitespace-nowrap rounded-full border-2 border-ink px-2 text-xs font-semibold text-ink ${color.label}`}
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
