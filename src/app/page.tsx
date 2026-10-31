"use client";

import { useState } from "react";

// Same shape the /api/detect route returns.
type DetectedObject = {
  name: string;
  material: string;
  color: string;
};

const MAX_SIZE = 1024; // longest side, in pixels
const JPEG_QUALITY = 0.85;

// Read a File into a data URL ("data:image/...;base64,...").
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

// Shrink an image so its longest side is at most MAX_SIZE, and re-encode as JPEG.
// This keeps the request to the server (and the model) small and fast.
function downscale(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => reject(new Error("That file doesn't look like an image."));
    img.src = dataUrl;
  });
}

export default function Home() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  // Indexes of the objects the user has put in the cauldron.
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow picking the same file again
    if (!file) return;

    setError(null);
    setObjects([]);
    setSelected([]);
    setLoading(true);

    try {
      const image = await downscale(await readAsDataUrl(file));
      setPhoto(image);

      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Detection failed.");

      setObjects(data.objects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(index: number) {
    setSelected((current) =>
      current.includes(index) ? current.filter((i) => i !== index) : [...current, index]
    );
  }

  return (
    <div className="flex flex-1 justify-center bg-gradient-to-b from-[#0b0717] via-[#120a24] to-[#05030a] text-violet-50">
      <main className="flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">🧪 Alchemia</h1>
          <p className="mt-2 text-violet-300/80">Turn what you have into what you need.</p>
        </header>

        {/* Upload box — the whole area is a label, so tapping anywhere opens the picker. */}
        <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-500/40 bg-violet-950/30 p-6 text-center transition hover:border-violet-400 hover:bg-violet-900/30">
          <span className="text-2xl font-semibold text-violet-200">＋ Add something</span>
          <span className="text-sm text-violet-300/60">Snap or upload a photo of everyday objects</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={loading} />
        </label>

        {photo && (
          // A plain <img> is fine here: the source is a local data URL, not a remote image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt="Your uploaded photo"
            className="max-h-80 w-full rounded-2xl border border-violet-500/20 object-contain"
          />
        )}

        {loading && (
          <p className="animate-pulse text-center text-violet-300">✨ Alchemia is looking…</p>
        )}

        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
            {error}
          </p>
        )}

        {objects.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-violet-200">Found ingredients</h2>
            <div className="flex flex-wrap gap-2">
              {objects.map((obj, i) => {
                const isSelected = selected.includes(i);
                return (
                  <button
                    key={i}
                    onClick={() => toggle(i)}
                    title={`${obj.color} · ${obj.material}`}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      isSelected
                        ? "border-amber-300 bg-amber-400/20 text-amber-100"
                        : "border-violet-500/40 bg-violet-900/30 text-violet-100 hover:border-violet-300"
                    }`}
                  >
                    {isSelected ? "✓ " : ""}
                    {obj.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-violet-300/50">Tap an object to add it to the cauldron.</p>
          </section>
        )}

        {objects.length > 0 && (
          <section className="rounded-2xl border border-amber-400/30 bg-amber-950/20 p-4">
            <h2 className="mb-3 text-lg font-semibold text-amber-200">⚗️ Cauldron</h2>
            {selected.length === 0 ? (
              <p className="text-sm text-amber-100/50">Empty — tap ingredients above to add them.</p>
            ) : (
              <ul className="space-y-1">
                {selected.map((i) => (
                  <li key={i} className="flex items-center justify-between text-amber-50">
                    <span>{objects[i].name}</span>
                    <span className="text-xs text-amber-200/60">
                      {objects[i].color} · {objects[i].material}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
