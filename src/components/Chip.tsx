"use client";

import { useState } from "react";

type ChipProps = {
  emoji: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
  title?: string;
  badge?: string; // optional small extra emoji after the label, e.g. ✍️ for typed ingredients
};

// A chunky, tappable chip (ingredients, budget, time). It does a little "pop" bounce when tapped.
export function Chip({ emoji, label, selected, onToggle, title, badge }: ChipProps) {
  const [popping, setPopping] = useState(false);

  function handleClick() {
    setPopping(true);
    onToggle();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onAnimationEnd={() => setPopping(false)}
      aria-pressed={selected}
      title={title}
      className={`pressable flex min-h-12 items-center gap-2 rounded-full border-thick border-ink px-4 py-2 text-base font-medium shadow-sticker ${
        selected ? "bg-sunny" : "bg-white"
      } ${popping ? "pop" : ""}`}
    >
      <span aria-hidden="true" className="text-xl">
        {emoji}
      </span>
      {label}
      {badge && (
        <span aria-hidden="true" className="text-sm">
          {badge}
        </span>
      )}
      {selected && <span aria-hidden="true">✓</span>}
    </button>
  );
}
