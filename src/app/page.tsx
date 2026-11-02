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
import { useBubbleLine, useLongWait, useSettledValue, type BubbleSituation } from "@/lib/bubbleLines";
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
import type {
  BuildGuide,
  BuildState,
  Idea,
  Ingredient,
  PhotoBox,
  PictureCheck,
  UploadedPhoto,
  VoiceIntent,
} from "@/lib/types";

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
  pictureOutdated: boolean; // that version was showing an older picture
  build: BuildState | null; // that version's Build Mode (guide, checkmarks, position)
};

const MAX_PHOTOS = 3;
const MAX_SIZE = 1024; // longest side, in pixels
const CHECK_SIZE = 768; // longest side of the concept picture sent to /api/check-picture
const JPEG_QUALITY = 0.8;
const MAX_REPAINTS = 2; // "Repaint" after a picture check, per idea
const MAX_STEP_PICTURE_REQUESTS = 2; // step pictures painted at the same time (the opened step + the next)
const MAX_STEP_PICTURE_TRIES = 3; // per step: 1 automatic + up to 2 "Try painting this step" taps

// Step pictures asked for with one guide, for the once-per-build usage log.
type StepPictureUse = { asked: Set<number>; calls: number; ms: number; logged: boolean };

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

// How long `work` takes, in milliseconds (for the step picture usage log). `work` handles its own errors.
async function timeIt(work: () => Promise<void>): Promise<number> {
  const started = Date.now();
  await work();
  return Date.now() - started;
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
  // True after a tweak until its new picture arrives: the picture on screen is the previous version's.
  const [pictureOutdated, setPictureOutdated] = useState(false);
  // How many tweaks this idea has had (only for Bubbles' "you kept improving it" line).
  const [tweakCount, setTweakCount] = useState(0);

  // Tweaks: the tweaked version of the idea, the (possibly reduced) ingredient list,
  // one step of history, and the last tweak asked for (for "Try again").
  const [tweakedIdea, setTweakedIdea] = useState<Idea | null>(null);
  const [tweakIngredients, setTweakIngredients] = useState<string[] | null>(null);
  const [previous, setPrevious] = useState<Snapshot | null>(null);
  const [tweaking, setTweaking] = useState(false);
  const [tweakError, setTweakError] = useState<string | null>(null);
  const [lastTweak, setLastTweak] = useState<{ kind: TweakKind; missing?: string[] } | null>(null);

  // Build Mode (step 5): the guide for one version of the idea, and its request.
  const [build, setBuild] = useState<BuildState | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  // Step pictures: how many requests are running, the opened step waiting for a free slot,
  // and what each guide has asked for (kept outside React state: they change between renders).
  const stepPicturesRunning = useRef(0);
  const waitingStepPicture = useRef<{ target: BuildState; index: number } | null>(null);
  const stepPictureUse = useRef(new WeakMap<BuildGuide, StepPictureUse>());

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
  // The concept picture of the shown version (none while the picture on screen is the previous version's).
  const buildPicture = pictureOutdated ? null : conceptImage;
  // Build Mode only counts for the version it was made for: a tweak or a new picture needs a new guide.
  const currentBuild = build && build.idea === shownIdea && build.picture === buildPicture ? build : null;

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
    setPictureOutdated(false);
    setTweakCount(0);
    setTweakedIdea(null);
    setTweakIngredients(null);
    setPrevious(null);
    setTweaking(false);
    setTweakError(null);
    setLastTweak(null);
    logStepPictureUse(build?.guide);
    logStepPictureUse(previous?.build?.guide);
    waitingStepPicture.current = null;
    setBuild(null);
    setGuideLoading(false);
    setGuideError(null);
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
      setPictureOutdated(false);
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
      setPrevious({
        tweakedIdea,
        image: conceptImage,
        ingredients: tweakIngredients,
        check: pictureCheck,
        pictureOutdated,
        build: currentBuild,
      });
      setTweakedIdea(data.idea);
      setTweakIngredients(data.ingredients);
      setRepaints(0); // a new version of the idea gets its own repaints
      setTweakCount((count) => count + 1);
      // The new idea shows right away; until its picture arrives (or if painting fails),
      // the old picture stays, labelled as the previous version's.
      if (conceptImage) setPictureOutdated(true);
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
    setPictureOutdated(previous.pictureOutdated);
    setBuild(previous.build); // that version's guide and checkmarks come back too
    setGuideError(null);
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

  // ---------- Build Mode (step 5) ----------

  // Change the Build Mode that owns `guide`, wherever it is now: on screen, or saved as the
  // previous version (an answer can arrive after a tweak).
  function updateBuild(guide: BuildGuide, change: (current: BuildState) => BuildState) {
    setBuild((b) => (b?.guide === guide ? change(b) : b));
    setPrevious((p) => (p?.build?.guide === guide ? { ...p, build: change(p.build) } : p));
  }

  // "🛠️ Start Build Mode": ask Muse Spark for the guide of the shown version, then show the preview.
  async function startBuildMode() {
    if (!shownIdea || guideLoading) return;
    const idea = shownIdea;
    const picture = buildPicture;
    const id = requestId.current; // a tweak, new picture or new idea changes this: the answer is then ignored
    logStepPictureUse(build?.guide); // the build this one replaces
    setGuideError(null);
    setGuideLoading(true);

    // The concept picture is shrunk once (in the browser) and reused for every step picture.
    // If that fails (e.g. a URL the canvas may not read), the original is sent instead.
    const reference = picture ? downscale(picture).catch(() => picture) : Promise.resolve(null);

    try {
      const guidePromise = postJson<BuildGuide>("/api/guide", {
        idea: {
          title: idea.title,
          description: idea.description,
          materialsUsed: idea.materialsUsed,
          roles: idea.roles,
          buildSteps: idea.buildSteps,
          safetyNote: idea.safetyNote,
          timeMinutes: idea.timeMinutes,
          difficulty: idea.difficulty,
        },
        ingredients: currentIngredients,
      });
      const [guide, smallPicture] = await Promise.all([guidePromise, reference]);
      if (id !== requestId.current) return;
      setBuild({
        idea,
        picture,
        reference: smallPicture,
        guide,
        started: false,
        current: 0,
        done: guide.steps.map(() => false),
        stepImages: {},
      });
    } catch (err) {
      if (id === requestId.current) setGuideError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGuideLoading(false);
    }
  }

  // Show step `index` of the guide on screen, and paint its picture (and the next one's).
  function openBuildStep(target: BuildState, index: number) {
    updateBuild(target.guide, (b) => ({ ...b, started: true, current: index }));
    wantStepPictures(target, index);
  }

  // "✓ Done": check the step, then go to the next one (the last step stays on screen).
  function finishBuildStep() {
    if (!currentBuild) return;
    const { current, guide } = currentBuild;
    updateBuild(guide, (b) => ({ ...b, done: b.done.map((done, i) => done || i === current) }));
    if (current < guide.steps.length - 1) openBuildStep(currentBuild, current + 1);
    else logStepPictureUse(guide); // all done: report this build's picture use once
  }

  // ---------- Step pictures (only for steps the user opens, plus the next one) ----------

  function stepPictureUseOf(guide: BuildGuide): StepPictureUse {
    let use = stepPictureUse.current.get(guide);
    if (!use) {
      use = { asked: new Set(), calls: 0, ms: 0, logged: false };
      stepPictureUse.current.set(guide, use);
    }
    return use;
  }

  // Once per build, in the browser console: how many step pictures were asked for, and how long
  // they took (to check credit use). Never the pictures themselves.
  function logStepPictureUse(guide: BuildGuide | undefined) {
    const use = guide && stepPictureUse.current.get(guide);
    if (!use || use.calls === 0 || use.logged) return;
    use.logged = true;
    console.info(`Build Mode: ${use.calls} step picture request(s), ${(use.ms / 1000).toFixed(1)} s in total`);
  }

  // Does this step get a painted picture? Not in the simple guide, not without a concept picture,
  // and not the last step (it shows the concept picture of the finished project).
  function paintsStepPicture(target: BuildState, index: number): boolean {
    return !target.guide.fallback && target.picture !== null && index >= 0 && index < target.guide.steps.length - 1;
  }

  // Paint the opened step's picture, then prefetch the next step's. Never more than
  // MAX_STEP_PICTURE_REQUESTS at a time: if all are busy, the opened step goes next.
  function wantStepPictures(target: BuildState, index: number) {
    waitingStepPicture.current = null;
    const use = stepPictureUseOf(target.guide);
    for (const i of [index, index + 1]) {
      if (!paintsStepPicture(target, i) || use.asked.has(i)) continue;
      if (stepPicturesRunning.current >= MAX_STEP_PICTURE_REQUESTS) {
        if (i === index) waitingStepPicture.current = { target, index };
        return;
      }
      paintStepPicture(target, i);
    }
  }

  // "🎨 Try painting this step" (at most MAX_STEP_PICTURE_TRIES paid attempts per step).
  function retryStepPicture() {
    if (!currentBuild) return;
    const { current, guide, stepImages } = currentBuild;
    if ((stepImages[current]?.tries ?? 0) >= MAX_STEP_PICTURE_TRIES) return;
    stepPictureUseOf(guide).asked.delete(current);
    wantStepPictures(currentBuild, current);
  }

  async function paintStepPicture(target: BuildState, index: number) {
    const { guide } = target;
    const use = stepPictureUseOf(guide);
    use.asked.add(index);
    stepPicturesRunning.current++;
    const tries = (target.stepImages[index]?.tries ?? 0) + 1;
    const setState = (state: BuildState["stepImages"][number]) =>
      updateBuild(guide, (b) => ({ ...b, stepImages: { ...b.stepImages, [index]: state } }));
    setState({ status: "painting", tries });

    // Every ingredient used in steps 1..n (with colors): a step picture shows what's built so far.
    const usedSoFar = [...new Set(guide.steps.slice(0, index + 1).flatMap((step) => step.ingredients))];
    const step = guide.steps[index];
    const ms = await timeIt(async () => {
      try {
        const data = await postJson<{ image: string }>("/api/step-image", {
          picture: target.reference ?? target.picture,
          photo: photos[0]?.dataUrl, // already downscaled when it was uploaded
          step: { title: step.title, result: step.result || step.title, ingredients: step.ingredients },
          stepNumber: index + 1,
          totalSteps: guide.steps.length,
          materials: describeMaterials(ingredients, usedSoFar),
          title: target.idea.title,
        });
        setState({ status: "done", image: data.image, tries });
      } catch (err) {
        console.error(`Couldn't paint step ${index + 1}:`, err instanceof Error ? err.message : err);
        setState({ status: "failed", tries });
      }
    });

    stepPicturesRunning.current--;
    use.calls++;
    use.ms += ms;
    // A step that was opened while both slots were busy goes next.
    const waiting = waitingStepPicture.current;
    if (waiting) wantStepPictures(waiting.target, waiting.index);
  }

  // "← Back": the step before, or the preview from step 1.
  function buildStepBack() {
    if (!currentBuild) return;
    if (currentBuild.current === 0) {
      updateBuild(currentBuild.guide, (b) => ({ ...b, started: false }));
    } else {
      openBuildStep(currentBuild, currentBuild.current - 1);
    }
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
  const busy = loading || brewing || visualizing || tweaking || guideLoading;
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
  const working = brewing || visualizing || tweaking || guideLoading;
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

  // ---------- What Bubbles says (templates in bubbleLines.ts; no API calls) ----------
  // The goal only counts once the user has stopped typing for a second.
  const settledGoal = useSettledValue(goal.trim(), 1000);
  // The same request running for 12 s (like BrewProgress's "still working" hint).
  const longWait = useLongWait(
    loading ? "detect" : brewing ? "brew" : tweaking ? "tweak" : visualizing ? "paint" : guideLoading ? "guide" : null
  );

  function bubbleSituation(): BubbleSituation {
    if (longWait) return { kind: "slow" };
    const title = shownIdea?.title ?? "";
    switch (currentStep) {
      case 1:
        if (loading) return { kind: "show-reading" };
        if (ingredients.length > 0) return { kind: "show-found", count: ingredients.length };
        return photos.length > 0 || error ? { kind: "show-none" } : { kind: "show-empty" };
      case 2:
        return settledGoal !== "" ? { kind: "need-goal", goal: settledGoal, free: budget === 0 } : { kind: "need" };
      case 3:
        if (brewing) return { kind: "brewing", count: selectedIngredients.length };
        if (brewError) return { kind: "brew-error" };
        return { kind: "ideas", goal: brewedWith?.goal ?? settledGoal };
      case 4:
        if (tweaking && lastTweak?.kind === "missing") {
          return { kind: "tweak-missing", item: lastTweak.missing?.join(", ") || "that" };
        }
        if (tweaking) return { kind: lastTweak?.kind === "weird" ? "tweak-weird" : "tweak-easier" };
        if (visualizeError) return { kind: "paint-failed" };
        if (visualizing) return { kind: "painting", title };
        return { kind: "picture", title };
      default: {
        if (guideLoading) return { kind: "build-start" };
        if (!currentBuild) return { kind: "build", title, manyTweaks: tweakCount >= 3 };
        const { started, current, done, guide, stepImages } = currentBuild;
        const last = guide.steps.length - 1;
        if (!started) return { kind: "build-preview" };
        if (done[last]) return { kind: "build-done" };
        if (stepImages[current]?.status === "failed") return { kind: "step-picture-failed" };
        if (current === last) return { kind: "build-last" };
        return { kind: "build-step", n: current + 1 };
      }
    }
  }
  const bubbleLine = useBubbleLine(bubbleSituation());

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
              say={bubbleLine}
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
              say={bubbleLine}
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
              say={bubbleLine}
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
              say={bubbleLine}
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
              pictureOutdated={pictureOutdated}
            />
          )}

          {currentStep === 5 && (
            <BuildStep
              headingRef={stepHeading}
              say={bubbleLine}
              bubbling={bubbling}
              idea={shownIdea}
              ingredients={ingredients}
              useEverything={brewedUseEverything}
              canStartNew={!loading && !working && !voiceActive}
              onBack={() => goToStep(4)}
              onStartNew={startNewInvention}
              build={currentBuild}
              guideLoading={guideLoading}
              guideError={guideError}
              canStartBuild={!working}
              startBuildReason={
                visualizing || tweaking ? "Wait for the new concept picture first" : "Wait for Alchemia to finish first"
              }
              onStartBuild={startBuildMode}
              onBeginSteps={() => currentBuild && openBuildStep(currentBuild, currentBuild.current)}
              onStepDone={finishBuildStep}
              onStepBack={buildStepBack}
              onJumpToStep={(index) => currentBuild && openBuildStep(currentBuild, index)}
              canRetryStepPicture={
                (currentBuild?.stepImages[currentBuild.current]?.tries ?? 0) < MAX_STEP_PICTURE_TRIES
              }
              onRetryStepPicture={retryStepPicture}
            />
          )}
        </div>
      </main>
    </div>
  );
}
