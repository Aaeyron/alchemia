"use client";

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
          className={`h-16 w-16 overflow-hidden rounded-xl border-[3px] border-ink bg-white ${
            photo.id === activeId ? "outline-4 outline-offset-2 outline-pink" : ""
          }`}
        >
          {/* A plain <img> is fine here: the source is a local data URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.dataUrl} alt="" className="h-full w-full object-cover" />
        </button>
      ))}

      {canAdd && (
        <label
          className={`sticker pressable flex min-h-12 items-center gap-2 bg-white px-4 py-2 font-semibold ${
            busy ? "pointer-events-none opacity-60" : ""
          }`}
        >
          📷 Add another photo
          <input
            type="file"
            accept="image/*"
            className="hidden"
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
