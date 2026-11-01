"use client";

import { buttonClasses } from "@/components/Button";
import type { UploadedPhoto } from "@/lib/types";

type PhotoStripProps = {
  photos: UploadedPhoto[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAddPhoto: (file: File) => void;
  canAdd: boolean; // false once there are 3 photos
  busy: boolean; // a photo is being processed
};

// Small thumbnails of the uploaded photos (tap one to show it) and "Add another photo".
export function PhotoStrip({ photos, activeId, onSelect, onAddPhoto, canAdd, busy }: PhotoStripProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {photos.map((photo, i) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onSelect(photo.id)}
          aria-pressed={photo.id === activeId}
          aria-label={`Show photo ${i + 1}`}
          className={`h-16 w-16 overflow-hidden rounded-control border-thick border-ink bg-white ${
            photo.id === activeId ? "outline-4 outline-offset-2 outline-pink" : ""
          }`}
        >
          {/* A plain <img> is fine here: the source is a local data URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.dataUrl} alt="" className="h-full w-full object-cover" />
        </button>
      ))}

      {canAdd && (
        // A label (so tapping it opens the file picker) that looks like a secondary button.
        <label aria-disabled={busy} className={`${buttonClasses("secondary")} focus-within:outline-4 focus-within:outline-focus`}>
          📸 Add another photo
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = ""; // allow picking the same file again
              if (file) onAddPhoto(file);
            }}
          />
        </label>
      )}
    </div>
  );
}
