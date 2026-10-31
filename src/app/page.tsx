"use client";

import { useRef, useState } from "react";
import { BrewForm } from "@/components/BrewForm";
import { Chip } from "@/components/Chip";
import { ErrorBox } from "@/components/ErrorBox";
import { IdeaCard } from "@/components/IdeaCard";
import { Mascot } from "@/components/Mascot";
import { PhotoBoxes } from "@/components/PhotoBoxes";
import { ResultPanel } from "@/components/ResultPanel";
import { TweakPanel, type TweakKind } from "@/components/TweakPanel";
import { emojiFor } from "@/lib/emoji";
import type { Idea, PhotoBox } from "@/lib/types";

// Same shape the /api/detect route returns.
type DetectedObject = {
  name: string;
  material: string;
  color: string;
};

// The ingredients and limits the current ideas were brewed with (tweaks reuse them).
type BrewRequest = {
  ingredients: string[];
  goal: string;
  budgetPhp: number;
  timeMinutes: number;
};

// One saved version of the result, for "Back to previous version".
type Snapshot = {
  tweakedIdea: Idea | null; // null = the original chosen idea
  image: string | null;
  ingredients: string[] | null; // null = the brewed ingredients
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

  // Boxes around the objects in the photo (from SAM). Optional: the chips work without them.
  const [boxes, setBoxes] = useState<PhotoBox[]>([]);
  const [segmenting, setSegmenting] = useState(false);
  // Which box should pop because its chip was just tapped (`count` changes on every tap).
  const [flash, setFlash] = useState<{ index: number; count: number } | null>(null);
  // Bumped on every new photo, so boxes for an older photo are ignored.
  const photoRequest = useRef(0);

  // Brewing: what the user needs, their limits, and the ideas Muse Spark comes back with.
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState(0);
  const [time, setTime] = useState(10);
  const [brewing, setBrewing] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [brewedWith, setBrewedWith] = useState<BrewRequest | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);

  // Concept picture for the chosen idea (only made when the user taps "Show me!").
  const [visualizing, setVisualizing] = useState(false);
  const [conceptImage, setConceptImage] = useState<string | null>(null);
  const [visualizeError, setVisualizeError] = useState<string | null>(null);

  // Tweaks: the tweaked version of the idea, the (possibly reduced) ingredient list,
  // one step of history, and the last tweak asked for (for "Try again").
  const [tweakedIdea, setTweakedIdea] = useState<Idea | null>(null);
  const [tweakIngredients, setTweakIngredients] = useState<string[] | null>(null);
  const [previous, setPrevious] = useState<Snapshot | null>(null);
  const [tweaking, setTweaking] = useState(false);
  const [tweakError, setTweakError] = useState<string | null>(null);
  const [lastTweak, setLastTweak] = useState<{ kind: TweakKind; missing?: string[] } | null>(null);

  // The spot where the idea cards / result panel appear, so we can scroll back to it.
  const ideasArea = useRef<HTMLDivElement>(null);
  // Bumped whenever the user moves on, so answers to older requests are ignored.
  const requestId = useRef(0);

  const chosenIdea = chosen !== null ? ideas[chosen] : null;
  // The idea shown in the result panel: the latest tweak, or the chosen card.
  const shownIdea = tweakedIdea ?? chosenIdea;
  const currentIngredients = tweakIngredients ?? brewedWith?.ingredients ?? [];

  // Clear the picture, any tweaks and their history (and ignore requests still running).
  function clearResult() {
    requestId.current++;
    setConceptImage(null);
    setVisualizing(false);
    setVisualizeError(null);
    setTweakedIdea(null);
    setTweakIngredients(null);
    setPrevious(null);
    setTweaking(false);
    setTweakError(null);
    setLastTweak(null);
  }

  // Wait one tick so React has swapped cards <-> result before scrolling.
  function scrollToIdeasArea() {
    setTimeout(() => ideasArea.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow picking the same file again
    if (!file) return;

    const id = ++photoRequest.current;
    setError(null);
    setObjects([]);
    setSelected([]);
    setBoxes([]);
    setSegmenting(false);
    setFlash(null);
    setIdeas([]);
    setChosen(null);
    clearResult();
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
      findBoxes(image, data.objects, id); // runs in the background; no need to wait
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Ask /api/segment for boxes around the detected objects (first 8).
  // Any failure just means no boxes: the chips keep working.
  async function findBoxes(image: string, found: DetectedObject[], id: number) {
    const names = found.slice(0, 8).map((obj) => obj.name);
    if (names.length === 0) return;
    setSegmenting(true);

    try {
      const res = await fetch("/api/segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, names }),
      });
      const data = await res.json();
      if (id === photoRequest.current && res.ok && Array.isArray(data.boxes)) {
        setBoxes(data.boxes);
      }
    } catch (err) {
      console.error("Couldn't find boxes:", err);
    } finally {
      if (id === photoRequest.current) setSegmenting(false);
    }
  }

  function toggle(index: number) {
    setSelected((current) =>
      current.includes(index) ? current.filter((i) => i !== index) : [...current, index]
    );
  }

  // Tapping a chip also makes its box in the photo pop.
  function toggleFromChip(index: number) {
    toggle(index);
    setFlash((current) => ({ index, count: (current?.count ?? 0) + 1 }));
  }

  // Match each box to its detected object by name.
  const photoBoxes = boxes
    .map((box) => ({ box, index: objects.findIndex((obj) => obj.name === box.name) }))
    .filter((item) => item.index !== -1);

  async function brew() {
    setError(null);
    setIdeas([]);
    setChosen(null);
    clearResult();
    setBrewing(true);

    const request: BrewRequest = {
      ingredients: selected.map((i) => objects[i].name),
      goal: goal.trim(),
      budgetPhp: budget,
      timeMinutes: time,
    };

    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Brewing failed.");

      setIdeas(data.ideas);
      setBrewedWith(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBrewing(false);
    }
  }

  function chooseIdea(index: number) {
    if (visualizing) return; // don't switch while a picture is being made for the current one
    if (index !== chosen) clearResult();
    setChosen(index);
  }

  // Make a concept picture for an idea (the shown one by default).
  // The old picture stays on screen until the new one is ready.
  async function visualize(idea: Idea | null = shownIdea) {
    if (!idea) return;
    const id = ++requestId.current;
    const firstPicture = conceptImage === null;
    setVisualizeError(null);
    setVisualizing(true);

    try {
      const res = await fetch("/api/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: {
            title: idea.title,
            description: idea.description,
            materialsUsed: idea.materialsUsed,
          },
          ingredients: currentIngredients,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't make the picture.");
      if (id !== requestId.current) return; // the user moved on

      setConceptImage(data.image);
      if (firstPicture) scrollToIdeasArea();
    } catch (err) {
      if (id === requestId.current) {
        setVisualizeError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      if (id === requestId.current) setVisualizing(false);
    }
  }

  // Ask Muse Spark to change the shown idea, then paint a new picture for it.
  async function tweak(kind: TweakKind, missing?: string[]) {
    if (!shownIdea || !brewedWith) return;
    const id = ++requestId.current;
    setTweakError(null);
    setVisualizeError(null);
    setLastTweak({ kind, missing });
    setTweaking(true);

    try {
      const res = await fetch("/api/tweak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: shownIdea,
          ingredients: currentIngredients,
          goal: brewedWith.goal,
          budgetPhp: brewedWith.budgetPhp,
          timeMinutes: brewedWith.timeMinutes,
          tweak: kind,
          missing,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't tweak the idea.");
      if (id !== requestId.current) return; // the user moved on

      // Save the current version (one level of history), then show the new one.
      setPrevious({ tweakedIdea, image: conceptImage, ingredients: tweakIngredients });
      setTweakedIdea(data.idea);
      setTweakIngredients(data.ingredients);
      setTweaking(false);
      scrollToIdeasArea();
      visualize(data.idea);
    } catch (err) {
      if (id === requestId.current) {
        setTweakError(err instanceof Error ? err.message : "Something went wrong.");
        setTweaking(false);
      }
    }
  }

  function backToPrevious() {
    if (!previous) return;
    requestId.current++; // ignore a picture or tweak still running for the newer version
    setTweakedIdea(previous.tweakedIdea);
    setConceptImage(previous.image);
    setTweakIngredients(previous.ingredients);
    setPrevious(null);
    setVisualizing(false);
    setVisualizeError(null);
    setTweaking(false);
    setTweakError(null);
  }

  function backToIdeas() {
    clearResult(); // the ideas and the chosen card stay as they were
    scrollToIdeasArea();
  }

  return (
    <div className="flex flex-1 justify-center">
      <main className="flex w-full max-w-2xl flex-col gap-7 px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex flex-col items-center text-center">
          <Mascot bubbling={loading || brewing || visualizing || tweaking} />
          <h1 className="mt-2 text-5xl font-bold tracking-tight">Alchemia</h1>
          <p className="sticker mt-3 -rotate-1 bg-sunny-soft px-4 py-1.5 text-lg font-medium">
            Turn what you have into what you need.
          </p>
        </header>

        {/* Upload box — the whole area is a label, so tapping anywhere opens the picker. */}
        <label
          className={`sticker pressable flex min-h-44 flex-col items-center justify-center gap-2 bg-sky-soft p-6 text-center ${
            loading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <span aria-hidden="true" className="text-4xl">📸</span>
          <span className="text-2xl font-semibold">＋ Add something</span>
          <span className="text-base">Snap a photo of stuff around you!</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={loading} />
        </label>

        {photo && (
          // Polaroid-style frame, with tappable boxes once SAM has found the objects.
          <PhotoBoxes
            photo={photo}
            boxes={photoBoxes}
            selected={selected}
            onToggle={toggle}
            flash={flash}
          />
        )}

        {segmenting && (
          <p className="text-center text-base font-medium">🔎 Finding the edges…</p>
        )}

        {loading && (
          <p className="text-center text-xl font-semibold">🫧 Bubbling up ideas…</p>
        )}

        {error && (
          <p role="alert" className="sticker bg-pink-soft p-4 text-base">
            <strong>Oops! </strong>
            {error}
          </p>
        )}

        {objects.length > 0 && (
          <section>
            <h2 className="mb-1 text-2xl font-semibold">Pick your ingredients!</h2>
            <p className="mb-4 text-base">Tap things to toss them in the cauldron.</p>
            <div className="flex flex-wrap gap-3">
              {objects.map((obj, i) => (
                <Chip
                  key={i}
                  emoji={emojiFor(obj.name)}
                  label={obj.name}
                  selected={selected.includes(i)}
                  onToggle={() => toggleFromChip(i)}
                  title={`${obj.color} · ${obj.material}`}
                />
              ))}
            </div>
          </section>
        )}

        {objects.length > 0 && (
          <section className="sticker overflow-hidden bg-lavender-soft">
            {/* Chunky rim across the top of the cauldron box */}
            <div className="flex items-center justify-between border-b-[3px] border-ink bg-lavender px-5 py-3">
              <h2 className="text-2xl font-semibold">🧪 Your cauldron</h2>
              <span className="rounded-full border-[3px] border-ink bg-white px-3 text-lg font-semibold">
                {selected.length}
              </span>
            </div>
            <div className="p-5">
              {selected.length === 0 ? (
                <p className="text-base">Empty for now — tap an ingredient to add it!</p>
              ) : (
                <ul className="flex flex-wrap gap-3">
                  {selected.map((i, n) => (
                    <li
                      key={i}
                      className={`pop sticker flex items-center gap-1.5 rounded-2xl bg-white px-3 py-1.5 text-base ${
                        n % 2 === 0 ? "-rotate-2" : "rotate-2"
                      }`}
                    >
                      <span aria-hidden="true">{emojiFor(objects[i].name)}</span>
                      {objects[i].name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {selected.length > 0 && (
          <BrewForm
            goal={goal}
            onGoalChange={setGoal}
            budget={budget}
            onBudgetChange={setBudget}
            time={time}
            onTimeChange={setTime}
            brewing={brewing}
            onBrew={brew}
          />
        )}

        {brewing && (
          <p className="text-center text-xl font-semibold">✨ Mixing up something clever…</p>
        )}

        <div ref={ideasArea} className="flex scroll-mt-6 flex-col gap-7">
          {/* Show the result panel (and tweaks) in place of the cards once a concept picture exists. */}
          {shownIdea && photo && conceptImage ? (
            <>
              <ResultPanel idea={shownIdea} beforePhoto={photo} afterImage={conceptImage} onBack={backToIdeas} />
              <TweakPanel
                materials={shownIdea.materialsUsed}
                busy={tweaking || visualizing}
                tweaking={tweaking}
                onTweak={tweak}
                canGoBack={previous !== null}
                onBackToPrevious={backToPrevious}
                error={tweakError}
                onRetry={() => lastTweak && tweak(lastTweak.kind, lastTweak.missing)}
              />
            </>
          ) : (
            ideas.length > 0 && (
              <section className="flex flex-col gap-7">
                <div>
                  <h2 className="mb-1 text-2xl font-semibold">Your ideas are ready!</h2>
                  <p className="text-base">Tap the one you want to make.</p>
                </div>
                {ideas.map((idea, i) => (
                  <IdeaCard
                    key={i}
                    idea={idea}
                    index={i}
                    chosen={chosen === i}
                    onChoose={() => chooseIdea(i)}
                  />
                ))}

                {chosenIdea && (
                  <button
                    type="button"
                    onClick={() => visualize()}
                    disabled={visualizing}
                    className="sticker pressable min-h-14 bg-sunny px-6 py-3 text-xl font-bold disabled:pointer-events-none disabled:opacity-50"
                  >
                    ✨ Show me!
                  </button>
                )}
              </section>
            )
          )}

          {/* Picture progress and errors: under the cards, or under the result after a tweak. */}
          {visualizing && (
            <p className="text-center text-xl font-semibold">🎨 Painting your idea…</p>
          )}

          {visualizeError && <ErrorBox message={visualizeError} onRetry={() => visualize()} />}
        </div>
      </main>
    </div>
  );
}
