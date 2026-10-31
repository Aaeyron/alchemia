"use client";

import { useRef, useState } from "react";
import { AddIngredientForm } from "@/components/AddIngredientForm";
import { BrewForm } from "@/components/BrewForm";
import { BrewProgress } from "@/components/BrewProgress";
import { ErrorBox } from "@/components/ErrorBox";
import { IdeaCard } from "@/components/IdeaCard";
import { IngredientChip } from "@/components/IngredientChip";
import { Mascot } from "@/components/Mascot";
import { PhotoBoxes } from "@/components/PhotoBoxes";
import { PhotoStrip } from "@/components/PhotoStrip";
import { ResultPanel } from "@/components/ResultPanel";
import { TweakPanel, type TweakKind } from "@/components/TweakPanel";
import { VoiceButton } from "@/components/VoiceButton";
import { postJson } from "@/lib/api";
import { emojiFor } from "@/lib/emoji";
import {
  MAX_INGREDIENTS,
  MAX_NAME_LENGTH,
  colorFromName,
  describeMaterials,
  findByName,
  matchIngredient,
  mergeIngredients,
  newId,
  sameName,
} from "@/lib/ingredients";
import type { Idea, Ingredient, PhotoBox, UploadedPhoto, VoiceIntent } from "@/lib/types";

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
  colors: Record<string, string>; // known color per ingredient name, for the idea prompts
};

// One saved version of the result, for "Back to previous version".
type Snapshot = {
  tweakedIdea: Idea | null; // null = the original chosen idea
  image: string | null;
  ingredients: string[] | null; // null = the brewed ingredients
};

const MAX_PHOTOS = 3;
const MAX_SIZE = 1024; // longest side, in pixels
const JPEG_QUALITY = 0.8;

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
  // Photos (up to 3) and which one is shown big with its boxes.
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  // The shared ingredient list (from photos + typed), and the ids of the ones in the cauldron.
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // How many /api/segment calls are still running (boxes are optional: chips work without them).
  const [segmenting, setSegmenting] = useState(0);
  // Which box should pop because its chip was just tapped (`count` changes on every tap).
  const [flash, setFlash] = useState<{ id: string; count: number } | null>(null);
  // Bumped when the user starts over with a new first photo, so older answers are ignored.
  const session = useRef(0);

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

  // True while a voice recording / transcription / voice command is running.
  const [voiceActive, setVoiceActive] = useState(false);

  // The spot where the idea cards / result panel appear, so we can scroll back to it.
  const ideasArea = useRef<HTMLDivElement>(null);
  // Bumped whenever the user moves on, so answers to older requests are ignored.
  const requestId = useRef(0);

  const activePhoto = photos.find((photo) => photo.id === activePhotoId) ?? null;
  // Cauldron contents, in the order they were tapped.
  const selectedIngredients = selected
    .map((id) => ingredients.find((ingredient) => ingredient.id === id))
    .filter((ingredient): ingredient is Ingredient => ingredient !== undefined);

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

  // A new first photo starts a fresh session: clear photos, ingredients, ideas and results.
  function startOver() {
    session.current++;
    setPhotos([]);
    setActivePhotoId(null);
    setIngredients([]);
    setSelected([]);
    setSegmenting(0);
    setFlash(null);
    setIdeas([]);
    setChosen(null);
    setBrewedWith(null);
    clearResult();
  }

  // Downscale a photo, detect its objects, merge them into the list, then look for boxes.
  // `startNew` = the big upload box (start over); otherwise the photo is added to this session.
  async function addPhoto(file: File, startNew: boolean) {
    if (startNew) startOver();
    const sessionId = session.current;
    setError(null);
    setLoading(true);

    try {
      const image = await downscale(await readAsDataUrl(file));
      if (sessionId !== session.current) return;
      const photoId = newId("photo");
      setPhotos((current) => [...current, { id: photoId, dataUrl: image, boxes: [] }].slice(0, MAX_PHOTOS));
      setActivePhotoId(photoId);

      const data = await postJson<{ objects: DetectedObject[] }>("/api/detect", { image });
      if (sessionId !== session.current) return;

      const found: DetectedObject[] = data.objects;
      setIngredients((current) =>
        mergeIngredients(
          current,
          found.map((obj) => ({ name: obj.name, color: obj.color, material: obj.material })),
          "photo",
          photoId
        )
      );
      findBoxes(image, found.map((obj) => obj.name), photoId, sessionId); // runs in the background
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Ask /api/segment for boxes around one photo's objects (first 8), and keep them with that photo.
  // Any failure just means no boxes: the chips keep working.
  async function findBoxes(image: string, names: string[], photoId: string, sessionId: number) {
    const firstNames = names.slice(0, 8);
    if (firstNames.length === 0) return;
    setSegmenting((count) => count + 1);

    try {
      const data = await postJson<{ boxes: PhotoBox[] }>("/api/segment", { image, names: firstNames });
      if (sessionId === session.current && Array.isArray(data.boxes)) {
        const boxes: PhotoBox[] = data.boxes;
        setPhotos((current) => current.map((photo) => (photo.id === photoId ? { ...photo, boxes } : photo)));
      }
    } catch (err) {
      console.error("Couldn't find boxes:", err);
    } finally {
      if (sessionId === session.current) setSegmenting((count) => Math.max(0, count - 1));
    }
  }

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((i) => i !== id) : [...current, id]));
  }

  // Tapping a chip also makes its box in the photo pop.
  function toggleFromChip(id: string) {
    toggle(id);
    setFlash((current) => ({ id, count: (current?.count ?? 0) + 1 }));
  }

  // Typed ingredients: merged into the list (no duplicates) and put straight in the cauldron.
  // Returns the names that are now in the list (some may be dropped if it's full).
  function addTypedItems(rawNames: string[]): string[] {
    const names = rawNames.map((name) => name.trim().slice(0, MAX_NAME_LENGTH)).filter((name) => name !== "");
    if (names.length === 0) return [];
    // Typed items only get a color if the name says one, e.g. "red tape".
    const next = mergeIngredients(
      ingredients,
      names.map((name) => ({ name, color: colorFromName(name) })),
      "typed"
    );
    const added = names
      .map((name) => findByName(next, name))
      .filter((ingredient): ingredient is Ingredient => ingredient !== undefined);
    setIngredients(next);
    setSelected([...selected, ...added.map((ingredient) => ingredient.id).filter((id) => !selected.includes(id))]);
    return added.map((ingredient) => ingredient.name);
  }

  function addTyped(name: string) {
    addTypedItems([name]);
  }

  function removeIngredient(id: string) {
    setIngredients((current) => current.filter((ingredient) => ingredient.id !== id));
    setSelected((current) => current.filter((i) => i !== id));
  }

  // Match the active photo's boxes to ingredients by name (removed ingredients lose their box).
  const photoBoxes = (activePhoto?.boxes ?? []).flatMap((box) => {
    const ingredient = findByName(ingredients, box.name);
    return ingredient ? [{ box, id: ingredient.id, colorIndex: ingredients.indexOf(ingredient) }] : [];
  });

  async function brew() {
    setError(null);
    setIdeas([]);
    setChosen(null);
    clearResult();
    setBrewing(true);

    const colors: Record<string, string> = {};
    for (const ingredient of selectedIngredients) {
      if (ingredient.color) colors[ingredient.name] = ingredient.color;
    }

    const request: BrewRequest = {
      ingredients: selectedIngredients.map((ingredient) => ingredient.name),
      goal: goal.trim(),
      budgetPhp: budget,
      timeMinutes: time,
      colors,
    };

    try {
      const data = await postJson<{ ideas: Idea[] }>("/api/ideas", request);
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

  // Make a concept picture for an idea (the shown one by default), starting from the user's photos.
  // The old picture stays on screen until the new one is ready.
  async function visualize(idea: Idea | null = shownIdea) {
    if (!idea) return;
    const id = ++requestId.current;
    const firstPicture = conceptImage === null;
    setVisualizeError(null);
    setVisualizing(true);

    // Typed items in the current ingredient list that weren't seen in any photo.
    const typedOnly = ingredients
      .filter((ingredient) => ingredient.source === "typed")
      .filter((ingredient) => currentIngredients.some((name) => sameName(name, ingredient.name)))
      .map((ingredient) => ingredient.name);

    try {
      const data = await postJson<{ image: string }>("/api/visualize", {
        idea: {
          title: idea.title,
          description: idea.description,
          materialsUsed: idea.materialsUsed,
        },
        ingredients: currentIngredients,
        photos: photos.slice(0, MAX_PHOTOS).map((photo) => photo.dataUrl),
        typedOnly,
        materials: describeMaterials(ingredients, idea.materialsUsed),
      });
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
      const data = await postJson<{ idea: Idea; ingredients: string[] }>("/api/tweak", {
        idea: shownIdea,
        ingredients: currentIngredients,
        goal: brewedWith.goal,
        budgetPhp: brewedWith.budgetPhp,
        timeMinutes: brewedWith.timeMinutes,
        tweak: kind,
        missing,
        colors: brewedWith.colors,
      });
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

  // Voice: ask /api/voice-intent what the user meant, then do the same thing the buttons do.
  // Returns a short friendly reply for the mic button to show.
  async function handleVoiceText(text: string): Promise<string> {
    // Errors (including "You've used Alchemia a lot today!") are FriendlyErrors; the mic button shows them.
    const command = await postJson<VoiceIntent>("/api/voice-intent", {
      text,
      ingredients: ingredients.map((ingredient) => ingredient.name),
      goalSet: goal.trim() !== "",
      ideaMaterials: shownIdea?.materialsUsed ?? [],
    });

    switch (command.intent) {
      case "set_goal": {
        setGoal(command.goal ?? "");
        if (command.budgetPhp !== undefined) setBudget(command.budgetPhp);
        if (command.timeMinutes !== undefined) setTime(command.timeMinutes);
        return `Got it! Goal: “${command.goal}”. Press Brew when you're ready.`;
      }
      case "add_items": {
        const added = addTypedItems(command.items ?? []);
        return added.length > 0 ? `Added ${added.join(", ")} to your cauldron!` : "Your cauldron is full!";
      }
      case "missing":
      case "weird":
      case "easier": {
        if (!shownIdea || !brewedWith) return "Pick an idea first, then ask me to change it!";
        tweak(command.intent, command.intent === "missing" ? command.items : undefined);
        if (command.intent === "missing") return `OK, redesigning without ${command.items?.join(", ")}…`;
        return command.intent === "weird" ? "Making it weird…" : "Making it easier…";
      }
      default:
        return "I didn't catch that, try again!";
    }
  }

  // Can't start a recording while anything else is running.
  const busy = loading || brewing || visualizing || tweaking;
  const voiceButton = (
    <VoiceButton
      disabled={busy || voiceActive}
      keywords={ingredients.map((ingredient) => ingredient.name)}
      onActiveChange={setVoiceActive}
      onText={handleVoiceText}
    />
  );

  // The result panel replaces the idea cards once a concept picture exists.
  const resultShown = Boolean(shownIdea && photos.length > 0 && conceptImage);

  // For the result panel: the shown idea's materials (with colors), and photo items it doesn't use.
  const shownMaterials = shownIdea ? describeMaterials(ingredients, shownIdea.materialsUsed) : [];
  const usedIds = new Set(
    (shownIdea?.materialsUsed ?? []).map((name) => matchIngredient(ingredients, name)?.id)
  );
  const notUsed = ingredients
    .filter((ingredient) => ingredient.source === "photo" && !usedIds.has(ingredient.id))
    .map((ingredient) => ingredient.name);

  return (
    <div className="flex flex-1 justify-center">
      <main className="flex w-full max-w-2xl flex-col gap-7 px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex flex-col items-center text-center">
          <Mascot bubbling={loading || segmenting > 0 || brewing || visualizing || tweaking || voiceActive} />
          <h1 className="mt-2 text-5xl font-bold tracking-tight">Alchemia</h1>
          <p className="sticker mt-3 -rotate-1 bg-sunny-soft px-4 py-1.5 text-lg font-medium">
            Turn what you have into what you need.
          </p>
        </header>

        {/* Upload box — the whole area is a label, so tapping anywhere opens the picker.
            A photo picked here starts a fresh session. */}
        <label
          className={`sticker pressable flex min-h-44 flex-col items-center justify-center gap-2 bg-sky-soft p-6 text-center ${
            loading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <span aria-hidden="true" className="text-4xl">📸</span>
          <span className="text-2xl font-semibold">＋ Add something</span>
          <span className="text-base">Snap a photo of stuff around you!</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={loading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = ""; // allow picking the same file again
              if (file) addPhoto(file, true);
            }}
          />
        </label>

        {activePhoto && (
          // Polaroid-style frame, with tappable boxes once SAM has found the objects.
          <PhotoBoxes
            photo={activePhoto.dataUrl}
            boxes={photoBoxes}
            selected={selected}
            onToggle={toggle}
            flash={flash}
          />
        )}

        {photos.length > 0 && (
          <PhotoStrip
            photos={photos}
            activeId={activePhotoId}
            onSelect={setActivePhotoId}
            onAddPhoto={(file) => addPhoto(file, false)}
            canAdd={photos.length < MAX_PHOTOS}
            busy={loading}
          />
        )}

        {segmenting > 0 && (
          <div className="flex justify-center">
            <BrewProgress kind="segment" compact />
          </div>
        )}

        {loading && <BrewProgress kind="detect" photo={activePhoto?.dataUrl} />}

        {error && (
          <p role="alert" className="sticker bg-pink-soft p-4 text-base">
            <strong>Oops! </strong>
            {error}
          </p>
        )}

        {photos.length > 0 && (
          <section>
            <h2 className="mb-1 text-2xl font-semibold">Pick your ingredients!</h2>
            <p className="mb-4 text-base">Tap things to toss them in the cauldron.</p>
            <div className="flex flex-wrap gap-3">
              {ingredients.map((ingredient) => (
                <IngredientChip
                  key={ingredient.id}
                  ingredient={ingredient}
                  selected={selected.includes(ingredient.id)}
                  onToggle={() => toggleFromChip(ingredient.id)}
                  onRemove={() => removeIngredient(ingredient.id)}
                />
              ))}
            </div>
            <AddIngredientForm onAdd={addTyped} full={ingredients.length >= MAX_INGREDIENTS} />
          </section>
        )}

        {ingredients.length > 0 && (
          <section className="sticker overflow-hidden bg-lavender-soft">
            {/* Chunky rim across the top of the cauldron box */}
            <div className="flex items-center justify-between border-b-[3px] border-ink bg-lavender px-5 py-3">
              <h2 className="text-2xl font-semibold">🧪 Your cauldron</h2>
              <span className="rounded-full border-[3px] border-ink bg-white px-3 text-lg font-semibold">
                {selectedIngredients.length}
              </span>
            </div>
            <div className="p-5">
              {selectedIngredients.length === 0 ? (
                <p className="text-base">Empty for now — tap an ingredient to add it!</p>
              ) : (
                <ul className="flex flex-wrap gap-3">
                  {selectedIngredients.map((ingredient, n) => (
                    <li
                      key={ingredient.id}
                      className={`pop sticker flex items-center gap-1.5 rounded-2xl bg-white px-3 py-1.5 text-base ${
                        n % 2 === 0 ? "-rotate-2" : "rotate-2"
                      }`}
                    >
                      <span aria-hidden="true">{emojiFor(ingredient.name)}</span>
                      {ingredient.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {selectedIngredients.length > 0 && (
          <BrewForm
            goal={goal}
            onGoalChange={setGoal}
            budget={budget}
            onBudgetChange={setBudget}
            time={time}
            onTimeChange={setTime}
            brewing={brewing}
            onBrew={brew}
            voice={voiceButton}
          />
        )}

        <div ref={ideasArea} className="flex scroll-mt-6 flex-col gap-7">
          {/* The bubbling cauldron, right where the 3 idea cards will appear. */}
          {brewing && (
            <BrewProgress
              kind="brew"
              emojis={selectedIngredients.map((ingredient) => emojiFor(ingredient.name))}
            />
          )}

          {/* Show the result panel (and tweaks) in place of the cards once a concept picture exists. */}
          {resultShown && shownIdea && conceptImage ? (
            <>
              <ResultPanel
                idea={shownIdea}
                beforePhotos={photos.map((photo) => photo.dataUrl)}
                materials={shownMaterials}
                notUsed={notUsed}
                afterImage={conceptImage}
                painting={visualizing}
                onBack={backToIdeas}
              />
              <TweakPanel
                materials={shownIdea.materialsUsed}
                busy={tweaking || visualizing}
                tweaking={tweaking}
                onTweak={tweak}
                canGoBack={previous !== null}
                onBackToPrevious={backToPrevious}
                error={tweakError}
                onRetry={() => lastTweak && tweak(lastTweak.kind, lastTweak.missing)}
                voice={voiceButton}
              />
            </>
          ) : (
            ideas.length > 0 && (
              <section className="flex flex-col gap-7">
                <div>
                  <h2 className="mb-1 text-2xl font-semibold">Your ideas are ready!</h2>
                  <p className="text-base">Tap the one you want to make.</p>
                </div>
                {/* The cards pop in one after another (100 ms apart). */}
                {ideas.map((idea, i) => (
                  <div key={i} className="pop-in" style={{ animationDelay: `${i * 100}ms` }}>
                    <IdeaCard idea={idea} index={i} chosen={chosen === i} onChoose={() => chooseIdea(i)} />
                  </div>
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

          {/* First picture: the painting animation appears under the cards.
              (Later pictures show their progress inside the result panel's AFTER frame.) */}
          {visualizing && !resultShown && <BrewProgress kind="paint" />}

          {visualizeError && <ErrorBox message={visualizeError} onRetry={() => visualize()} />}
        </div>
      </main>
    </div>
  );
}
