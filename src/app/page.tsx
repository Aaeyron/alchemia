"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { TinyStars } from "@/components/Doodles";
import type { PictureCheckState } from "@/components/PictureCheckNote";
import { Stepper } from "@/components/Stepper";
import type { TweakKind } from "@/components/TweakPanel";
import { VoiceButton } from "@/components/VoiceButton";
import { BuildStep } from "@/components/steps/BuildStep";
import { IdeasStep } from "@/components/steps/IdeasStep";
import { NeedStep } from "@/components/steps/NeedStep";
import { SeeItStep } from "@/components/steps/SeeItStep";
import { ShowStep } from "@/components/steps/ShowStep";
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
import type { Idea, Ingredient, PhotoBox, PictureCheck, UploadedPhoto, VoiceIntent } from "@/lib/types";

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
  useEverything: boolean; // ideas must use every ingredient (tweaks reuse this too)
};

// One saved version of the result, for "Back to previous version".
type Snapshot = {
  tweakedIdea: Idea | null; // null = the original chosen idea
  image: string | null;
  ingredients: string[] | null; // null = the brewed ingredients
  check: PictureCheckState | null; // the picture check of that version
};

const MAX_PHOTOS = 3;
const MAX_SIZE = 1024; // longest side, in pixels
const CHECK_SIZE = 768; // longest side of the concept picture sent to /api/check-picture
const JPEG_QUALITY = 0.8;
const MAX_REPAINTS = 2; // "Repaint" after a picture check, per idea

// Read a File into a data URL ("data:image/...;base64,...").
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

// Shrink an image so its longest side is at most `maxSize`, and re-encode as JPEG.
// This keeps the request to the server (and the model) small and fast.
function downscale(dataUrl: string, maxSize = MAX_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // lets the canvas export a picture that came from a URL
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
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

// Same ingredient names, in any order?
function sameNames(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join("\n") === [...b].sort().join("\n");
}

export default function Home() {
  // Which screen is showing: 1 Show, 2 Need, 3 Ideas, 4 See it, 5 Build.
  const [currentStep, setCurrentStep] = useState(1);
  // The step's main heading gets focus after every move (for keyboard and screen reader users).
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const focusAfterMove = useRef(false);

  // Photos (up to 3) and which one is shown big with its boxes.
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  // The shared ingredient list (from photos + typed), and the ids of the ones in the cauldron.
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  // Errors stay on the step where the request started: photo errors on step 1, brew errors on step 3.
  const [error, setError] = useState<string | null>(null);
  const [brewError, setBrewError] = useState<string | null>(null);

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
  const [useEverything, setUseEverything] = useState(false);
  const [brewing, setBrewing] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [brewedWith, setBrewedWith] = useState<BrewRequest | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);

  // Concept picture for the chosen idea (only made when the user taps "Show me!").
  const [visualizing, setVisualizing] = useState(false);
  const [conceptImage, setConceptImage] = useState<string | null>(null);
  const [visualizeError, setVisualizeError] = useState<string | null>(null);
  // Background check of the concept picture on screen, and how many repaints this idea had.
  const [pictureCheck, setPictureCheck] = useState<PictureCheckState | null>(null);
  const [repaints, setRepaints] = useState(0);

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

  // The spot where the result panel appears (step 4), so we can scroll back to it.
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

  // Show another step: jump to the top, and move focus to its heading once it's on screen.
  function goToStep(step: number) {
    window.scrollTo({ top: 0 });
    if (step === currentStep) {
      stepHeading.current?.focus({ preventScroll: true });
      return;
    }
    focusAfterMove.current = true;
    setCurrentStep(step);
  }

  useEffect(() => {
    if (!focusAfterMove.current) return; // not on the first load
    focusAfterMove.current = false;
    stepHeading.current?.focus({ preventScroll: true });
  }, [currentStep]);

  // Clear the picture, any tweaks and their history (and ignore requests still running).
  function clearResult() {
    requestId.current++;
    setConceptImage(null);
    setVisualizing(false);
    setVisualizeError(null);
    setPictureCheck(null);
    setRepaints(0);
    setTweakedIdea(null);
    setTweakIngredients(null);
    setPrevious(null);
    setTweaking(false);
    setTweakError(null);
    setLastTweak(null);
  }

  // A check that was still running belongs to a picture that's being replaced: drop it,
  // so "double-checking" never shows while nothing is running. Finished results stay.
  function dropRunningCheck() {
    setPictureCheck((check) => (check?.status === "checking" ? null : check));
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
    setError(null);
    setBrewError(null);
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
    setBrewError(null);
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
      useEverything,
    };

    try {
      const data = await postJson<{ ideas: Idea[] }>("/api/ideas", request);
      setIdeas(data.ideas);
      setBrewedWith(request);
    } catch (err) {
      setBrewError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBrewing(false);
    }
  }

  function chooseIdea(index: number) {
    if (visualizing || tweaking) return; // don't switch while a picture or tweak is being made for the current one
    if (index !== chosen) clearResult();
    setChosen(index);
  }

  // Make a concept picture for an idea (the shown one by default), starting from the user's photos.
  // `cauldron` is the ingredient list for this idea (after a tweak, the tweak's list).
  // The old picture stays on screen until the new one is ready.
  async function visualize(idea: Idea | null = shownIdea, cauldron: string[] = currentIngredients) {
    if (!idea) return;
    const id = ++requestId.current;
    const firstPicture = conceptImage === null;
    setVisualizeError(null);
    dropRunningCheck();
    setVisualizing(true);

    // Typed items in the current ingredient list that weren't seen in any photo.
    const typedOnly = ingredients
      .filter((ingredient) => ingredient.source === "typed")
      .filter((ingredient) => cauldron.some((name) => sameName(name, ingredient.name)))
      .map((ingredient) => ingredient.name);

    try {
      const data = await postJson<{ image: string }>("/api/visualize", {
        idea: {
          title: idea.title,
          description: idea.description,
          materialsUsed: idea.materialsUsed,
        },
        ingredients: cauldron,
        photos: photos.slice(0, MAX_PHOTOS).map((photo) => photo.dataUrl),
        typedOnly,
        materials: describeMaterials(ingredients, idea.materialsUsed),
        roles: idea.roles, // "show each ingredient in its role"
      });
      if (id !== requestId.current) return; // the user moved on

      setConceptImage(data.image);
      if (firstPicture) scrollToIdeasArea();
      checkPicture(data.image, idea, cauldron, id); // runs in the background
    } catch (err) {
      if (id === requestId.current) {
        setVisualizeError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      if (id === requestId.current) setVisualizing(false);
    }
  }

  // Ask Muse Spark whether the concept picture shows the idea's ingredients (in the background;
  // nothing waits for it). `pictureRequest` is the visualize request number: if the user has
  // moved on since (new picture, tweak, other idea), the answer is ignored.
  async function checkPicture(image: string, idea: Idea, cauldron: string[], pictureRequest: number) {
    setPictureCheck({ status: "checking" });
    // The exact cauldron names this idea uses (from the recipe), or its own list as a fallback.
    const used = idea.roles.length > 0 ? idea.roles.map((role) => role.ingredient) : idea.materialsUsed;

    try {
      const small = await downscale(image, CHECK_SIZE);
      const result = await postJson<PictureCheck>("/api/check-picture", {
        image: small,
        ingredients: used.slice(0, 30),
        cauldron: cauldron.slice(0, 30),
      });
      if (pictureRequest === requestId.current) setPictureCheck({ status: "done", result });
    } catch (err) {
      console.error("Couldn't check the picture:", err);
      if (pictureRequest === requestId.current) setPictureCheck({ status: "error" });
    }
  }

  // "🔁 Repaint" after a picture check: same as Show me! for this idea, at most MAX_REPAINTS times.
  function repaint() {
    if (repaints >= MAX_REPAINTS) return;
    setRepaints(repaints + 1);
    visualize();
  }

  // Ask Muse Spark to change the shown idea, then paint a new picture for it.
  async function tweak(kind: TweakKind, missing?: string[]) {
    if (!shownIdea || !brewedWith) return;
    const id = ++requestId.current;
    setTweakError(null);
    setVisualizeError(null);
    dropRunningCheck();
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
        useEverything: brewedWith.useEverything,
      });
      if (id !== requestId.current) return; // the user moved on

      // Save the current version (one level of history), then show the new one.
      setPrevious({ tweakedIdea, image: conceptImage, ingredients: tweakIngredients, check: pictureCheck });
      setTweakedIdea(data.idea);
      setTweakIngredients(data.ingredients);
      setRepaints(0); // a new version of the idea gets its own repaints
      setTweaking(false);
      scrollToIdeasArea();
      visualize(data.idea, data.ingredients);
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
    setPictureCheck(previous.check?.status === "checking" ? null : previous.check);
    setPrevious(null);
    setVisualizing(false);
    setVisualizeError(null);
    setTweaking(false);
    setTweakError(null);
  }

  function backToIdeas() {
    clearResult(); // the ideas and the chosen card stay as they were
    goToStep(3);
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
        if (currentStep !== 4) return "Open your concept picture first (step 4), then ask me to change it!";
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

  // The result panel needs a concept picture (and the photos it was made from).
  const resultShown = Boolean(shownIdea && photos.length > 0 && conceptImage);

  // For the result panel: the shown idea's materials (with colors), and photo items it doesn't use.
  const shownMaterials = shownIdea ? describeMaterials(ingredients, shownIdea.materialsUsed) : [];
  const usedIds = new Set(
    (shownIdea?.materialsUsed ?? []).map((name) => matchIngredient(ingredients, name)?.id)
  );
  const notUsed = ingredients
    .filter((ingredient) => ingredient.source === "photo" && !usedIds.has(ingredient.id))
    .map((ingredient) => ingredient.name);

  // A brew, picture or tweak is running: buttons that would cancel or replace it wait.
  const working = brewing || visualizing || tweaking;
  const canBrew = selectedIngredients.length > 0 && goal.trim() !== "" && !working;
  const brewBlockedReason =
    selectedIngredients.length === 0
      ? "Pick at least one ingredient"
      : goal.trim() === ""
        ? "Tell Alchemia what you need first"
        : "Wait for Alchemia to finish first";

  // The ingredients, goal, budget, time or "use everything" changed since the ideas on screen were brewed.
  const ideasOutdated =
    ideas.length > 0 &&
    brewedWith !== null &&
    (!sameNames(
      selectedIngredients.map((ingredient) => ingredient.name),
      brewedWith.ingredients
    ) ||
      goal.trim() !== brewedWith.goal ||
      budget !== brewedWith.budgetPhp ||
      time !== brewedWith.timeMinutes ||
      useEverything !== brewedWith.useEverything);

  // What the shown ideas were brewed with (the cards and recipe stamps follow it, not the live toggle).
  const brewedUseEverything = brewedWith?.useEverything ?? false;

  // Which steps the stepper can open right now.
  const pictureStarted =
    shownIdea !== null && (conceptImage !== null || visualizing || tweaking || visualizeError !== null);
  const reachable = [
    true,
    selectedIngredients.length > 0,
    ideas.length > 0 || brewing || brewError !== null,
    pictureStarted,
    pictureStarted,
  ];

  // Brew starts the request and moves to the ideas right away.
  function brewAndGo() {
    if (!canBrew) return;
    goToStep(3);
    brew();
  }

  // "Show me!" starts the picture and moves to step 4 right away.
  // If this idea already has a picture (or one is on its way), it just shows it.
  function showMe() {
    if (!conceptImage && !visualizing && !tweaking) visualize();
    goToStep(4);
  }

  // Same reset as a new first photo, then back to step 1.
  function startNewInvention() {
    startOver();
    goToStep(1);
  }

  const bubbling = loading || segmenting > 0 || working || voiceActive;

  return (
    <div className="flex flex-1 justify-center">
      <main className="flex w-full max-w-2xl flex-col gap-section px-4 pt-6 pb-8 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-section">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-1 text-4xl font-bold tracking-tight">
                Alchemia
                <TinyStars className="h-6 w-9" />
              </h1>
              <p className="mt-2 inline-block -rotate-1 rounded-control border-thick border-ink bg-sunny-soft px-3 py-1 text-base font-medium shadow-sticker-sm">
                Turn what you have into what you need.
              </p>
            </div>
            {/* How many ingredients are in the cauldron; tap to change them. */}
            {selectedIngredients.length > 0 && (
              <Button
                onClick={() => goToStep(1)}
                aria-label={`${selectedIngredients.length} ingredients in the cauldron. Go to step 1.`}
                className="shrink-0 bg-lavender-soft"
              >
                🧪 {selectedIngredients.length}
              </Button>
            )}
          </div>

          <Stepper current={currentStep} reachable={reachable} onGo={goToStep} />
        </header>

        {/* A new key per step replays the short slide-in (switched off for reduced motion). */}
        <div key={currentStep} className="step-in">
          {currentStep === 1 && (
            <ShowStep
              headingRef={stepHeading}
              bubbling={bubbling}
              photos={photos}
              activePhoto={activePhoto}
              onSelectPhoto={setActivePhotoId}
              photoBoxes={photoBoxes}
              flash={flash}
              ingredients={ingredients}
              selected={selected}
              onToggleBox={toggle}
              onToggleChip={toggleFromChip}
              onRemove={removeIngredient}
              onAddTyped={addTyped}
              ingredientsFull={ingredients.length >= MAX_INGREDIENTS}
              onNewPhoto={(file) => addPhoto(file, true)}
              onAddPhoto={(file) => addPhoto(file, false)}
              canAddPhoto={photos.length < MAX_PHOTOS}
              loading={loading}
              uploadDisabled={loading || working}
              segmenting={segmenting > 0}
              error={error}
              onNext={() => goToStep(2)}
            />
          )}

          {currentStep === 2 && (
            <NeedStep
              headingRef={stepHeading}
              bubbling={bubbling}
              selectedIngredients={selectedIngredients}
              goal={goal}
              onGoalChange={setGoal}
              budget={budget}
              onBudgetChange={setBudget}
              time={time}
              onTimeChange={setTime}
              brewing={brewing}
              canBrew={canBrew}
              brewBlockedReason={brewBlockedReason}
              onBrew={brewAndGo}
              voice={voiceButton}
              onBack={() => goToStep(1)}
              useEverything={useEverything}
              onUseEverythingChange={setUseEverything}
            />
          )}

          {currentStep === 3 && (
            <IdeasStep
              headingRef={stepHeading}
              bubbling={bubbling}
              brewing={brewing}
              brewEmojis={selectedIngredients.map((ingredient) => emojiFor(ingredient.name))}
              ideas={ideas}
              chosen={chosen}
              onChoose={chooseIdea}
              error={brewError}
              outdated={ideasOutdated}
              canBrew={canBrew}
              onBrew={brewAndGo}
              onShowMe={showMe}
              onBack={() => goToStep(2)}
              useEverything={brewedUseEverything}
            />
          )}

          {currentStep === 4 && (
            <SeeItStep
              headingRef={stepHeading}
              resultRef={ideasArea}
              bubbling={bubbling}
              idea={shownIdea}
              beforePhotos={photos.map((photo) => photo.dataUrl)}
              materials={shownMaterials}
              notUsed={notUsed}
              conceptImage={resultShown ? conceptImage : null}
              visualizing={visualizing}
              visualizeError={visualizeError}
              onRetryPicture={() => visualize()}
              tweaking={tweaking}
              tweakError={tweakError}
              onTweak={tweak}
              onRetryTweak={() => lastTweak && tweak(lastTweak.kind, lastTweak.missing)}
              canGoBack={previous !== null}
              onBackToPrevious={backToPrevious}
              voice={voiceButton}
              onTryAnother={backToIdeas}
              onBuild={() => goToStep(5)}
              ingredients={ingredients}
              useEverything={brewedUseEverything}
              pictureCheck={pictureCheck}
              canRepaint={repaints < MAX_REPAINTS}
              onRepaint={repaint}
            />
          )}

          {currentStep === 5 && (
            <BuildStep
              headingRef={stepHeading}
              bubbling={bubbling}
              idea={shownIdea}
              ingredients={ingredients}
              useEverything={brewedUseEverything}
              canStartNew={!loading && !working && !voiceActive}
              onBack={() => goToStep(4)}
              onStartNew={startNewInvention}
            />
          )}
        </div>
      </main>
    </div>
  );
}
