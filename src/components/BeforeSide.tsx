"use client";

import { useState } from "react";
import { Polaroid } from "@/components/Polaroid";
import { emojiFor } from "@/lib/emoji";
import type { MaterialInfo } from "@/lib/types";

type BeforeSideProps = {
  photos: string[]; // all uploaded photos (up to 3)
  materials: MaterialInfo[]; // the ingredients this idea uses
  notUsed: string[]; // ingredients seen in the photos that this idea doesn't use
};

const THUMB_TILTS = ["-rotate-3", "rotate-2", "-rotate-1"];

// The BEFORE side of the result: the photos (tap a small one to show it big)
// and the list of ingredients the idea uses, with their colors.
export function BeforeSide({ photos, materials, notUsed }: BeforeSideProps) {
  const [active, setActive] = useState(0);
  const shown = Math.min(active, photos.length - 1); // stays valid if the photo list changes

  return (
    <div className="flex flex-col gap-4">
      <Polaroid
        src={photos[shown]}
        alt={`Your photo ${shown + 1}`}
        label={photos.length > 1 ? `Before (${shown + 1}/${photos.length})` : "Before"}
        tilt="-rotate-1"
        tape="tape-mint"
      />

      {/* Small tilted polaroids to switch between photos */}
      {photos.length > 1 && (
        <div className="flex justify-center gap-3">
          {photos.map((photo, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={i === shown}
              aria-label={`Show photo ${i + 1}`}
              className={`h-16 w-16 rounded-control border-thick border-ink bg-white p-1 shadow-sticker-sm ${
                THUMB_TILTS[i % THUMB_TILTS.length]
              } ${i === shown ? "outline-4 outline-offset-2 outline-pink" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" className="h-full w-full rounded-lg object-cover" />
            </button>
          ))}
        </div>
      )}

      <div>
        <h4 className="h-sub mb-2">Ingredients used</h4>
        <ul className="flex flex-wrap gap-2">
          {materials.map((material, i) => (
            <li key={i} className="flex items-center gap-1 rounded-control border-thin border-ink bg-white px-2 py-0.5 text-sm">
              <span aria-hidden="true">{emojiFor(material.name)}</span>
              {material.name}
              {material.color && ` · ${material.color}`}
              {material.source === "typed" && (
                <span aria-label="typed by you" className="text-xs">
                  ✍️
                </span>
              )}
            </li>
          ))}
        </ul>
        {notUsed.length > 0 && (
          <p className="mt-2 text-sm text-ink-soft">Ingredients this idea skips: {notUsed.join(", ")}</p>
        )}
      </div>
    </div>
  );
}
