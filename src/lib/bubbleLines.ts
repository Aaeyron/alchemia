// What Bubbles (the mascot) says, picked from templates in code. No API calls.
// Every line is plain text: React escapes it, and user text is trimmed and shortened first.
import { useEffect, useState } from "react";

// The moment Bubbles is reacting to. The page works this out from its state.
export type BubbleSituation =
  | { kind: "show-empty" }
  | { kind: "show-reading" }
  | { kind: "show-found"; count: number }
  | { kind: "show-none" }
  | { kind: "need" }
  | { kind: "need-goal"; goal: string; free: boolean }
  | { kind: "brewing"; count: number }
  | { kind: "ideas"; goal: string }
  | { kind: "brew-error" }
  | { kind: "tweak-missing"; item: string }
  | { kind: "tweak-weird" }
  | { kind: "tweak-easier" }
  | { kind: "painting"; title: string }
  | { kind: "picture"; title: string }
  | { kind: "paint-failed" }
  | { kind: "build"; title: string; manyTweaks: boolean }
  | { kind: "build-start" }
  | { kind: "build-preview" }
  | { kind: "build-step"; n: number }
  | { kind: "build-last" }
  | { kind: "build-done" }
  | { kind: "step-picture-failed" }
  | { kind: "done" }
  | { kind: "slow" };

// User text in a line: trimmed, on one line, and cut to about 40 characters with "…".
export function clip(text: string, max = 40): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

const plural = (n: number) => `${n} ingredient${n === 1 ? "" : "s"}`;

// 3-4 variants per situation (each under about 110 characters).
function variants(s: BubbleSituation): string[] {
  switch (s.kind) {
    case "show-empty":
      return [
        "Show me what you've got! Every great project starts with things you already have.",
        "Snap a photo of the things around you. I'll find the ingredients!",
        "Your desk, your bag, your room… there's treasure everywhere. Let's look!",
      ];
    case "show-reading":
      return ["Ooh, let me look closely…", "Hmm, what do we have here…", "Looking at every little thing…"];
    case "show-found":
      return [
        `I see ${plural(s.count)}. That's a lot of possibilities!`,
        `${plural(s.count)} found! Tap the ones you want in the cauldron.`,
        `Nice! ${plural(s.count)} to play with. Pick your favorites.`,
      ];
    case "show-none":
      return [
        "Hmm, I couldn't spot much. Try another angle or add ingredients by typing.",
        "My eyes need a little help. Try a brighter photo, or type what you have.",
        "Nothing clear yet. Another photo, or type an ingredient below!",
      ];
    case "need":
      return [
        "What do you need? Tell me your goal and I'll brew something up.",
        "What should we make today? Type it or say it!",
        "Tell me what you need, and how much time and money you have.",
      ];
    case "need-goal": {
      const goal = clip(s.goal);
      const lines = [
        `${goal}? Great goal. You've already started by asking.`,
        `${goal}… I like it! Ready when you are.`,
        `Ooh, ${goal}. Let's see what your cauldron can do!`,
      ];
      // Budget ₱0 adds a couple of its own lines to the mix.
      if (s.free) lines.push("₱0? No problem. Creativity is free!", "No money needed. Let's use what you have!");
      return lines;
    }
    case "brewing":
      return [
        `Stirring your ${plural(s.count)}… good ideas take a moment.`,
        `Bubble, bubble… mixing your ${plural(s.count)}!`,
        "Brewing! Checking your budget and time too…",
      ];
    case "ideas": {
      const goal = clip(s.goal);
      return [
        `Three ideas for ${goal}! Pick the one that excites you.`,
        "Fresh from the cauldron! Which one do you like best?",
        `Here you go: ideas for ${goal}. Sige, try natin!`,
      ];
    }
    case "brew-error":
      return [
        "Even alchemists have off days. Let's try again together.",
        "Oops, my cauldron sputtered. Let's give it another go!",
        "That didn't work this time. It happens! Try again?",
      ];
    case "tweak-missing": {
      const item = clip(s.item, 30);
      return [
        `No ${item}? No problem. We adapt and keep going!`,
        `Redesigning without ${item}. Makers improvise!`,
        `Okay, skipping ${item}. Let's see what else works.`,
      ];
    }
    case "tweak-weird":
      return [
        "Okay, let's get a little weird with it!",
        "Weird mode on! This could be fun.",
        "Let's make it surprising. Still safe, just strange!",
      ];
    case "tweak-easier":
      return [
        "Simpler is smart. You've got this!",
        "Making it easier. Small steps are still steps!",
        "Easier version coming up. Kaya mo 'yan!",
      ];
    case "painting": {
      const title = clip(s.title);
      return [
        `Painting ${title}… I can already picture it!`,
        `Mixing colors for ${title}…`,
        `Sketching ${title} from your real ingredients…`,
      ];
    }
    case "picture": {
      const title = clip(s.title);
      return [
        `Ta-da! ${title}. Want to change anything?`,
        `Here's ${title}! Tweak it until you love it.`,
        `${title}, ready for its close-up! Anything to change?`,
      ];
    }
    case "paint-failed":
      return [
        "The paint spilled! Your idea is still here. Try painting again?",
        "My brush slipped. Your idea is safe. Want me to try again?",
        "No picture this time, but your recipe and steps are all here.",
      ];
    case "build": {
      const title = clip(s.title);
      const lines = [
        `Let's build ${title}! One step at a time. Kaya mo 'yan!`,
        "Your first try doesn't have to be perfect. Just start.",
        `Step one of ${title}: get your ingredients ready!`,
      ];
      if (s.manyTweaks) lines.push("You kept improving it. That's what real makers do!");
      return lines;
    }
    case "build-start":
      return [
        "Writing your build guide, one clear step at a time…",
        "Let's plan the build! Grab your ingredients while I write.",
        "Build Mode, here we go! Planning every step…",
      ];
    case "build-preview":
      return [
        "Here's everything you need. Ready?",
        "Check your ingredients and the time. Ready to build?",
        "That's the whole plan! Read it, then let's go.",
      ];
    case "build-step":
      return [
        `Step ${s.n}: you're doing great!`,
        `Step ${s.n}! One thing at a time. Kaya mo 'yan!`,
        `On to step ${s.n}. Look at you go!`,
      ];
    case "build-last":
      return [
        "Last step! You're almost there!",
        "Final step! Finish strong, maker!",
        "One more step and it's done!",
      ];
    case "build-done":
      return [
        "You built it! I'm so proud of you!",
        "All steps done! That's a real invention!",
        "Finished! From ingredients to invention. Galing!",
      ];
    case "step-picture-failed":
      return [
        "The paint smudged, but the steps still work!",
        "No picture this time. The steps are all still here!",
        "My brush slipped! Keep going, the words have you covered.",
      ];
    case "done":
      return ["You did it! Now go make it real.", "Project ready! Go build it, maker!", "All set! Kaya mo 'yan!"];
    case "slow":
      return [
        "Still working… don't give up on me!",
        "This one's taking a while. Thanks for waiting!",
        "Almost… good things take a moment.",
      ];
  }
}

// A line for this situation, never the same as the line before it.
// `roll` (0 to 1) chooses among the options, so the same roll always gives the same line.
function pickLineWith(situation: BubbleSituation, previous: string | null, roll: number): string {
  const options = variants(situation);
  const fresh = options.filter((line) => line !== previous);
  const pool = fresh.length > 0 ? fresh : options;
  return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
}

// A random line for this situation, never the same as the line before it.
// Only for event handlers and callbacks, never during render (it uses Math.random()).
export function pickLine(situation: BubbleSituation, previous: string | null): string {
  return pickLineWith(situation, previous, Math.random());
}

// The current line. It only changes when the situation changes (a new step, results, an error,
// a tweak…), not on every render. Uses React's "update state while rendering" pattern.
//
// Rendering never uses randomness, so the server and the browser render the same first line:
// - the first line is always the situation's FIRST variant (no swap after loading, no flicker),
// - the random number for the NEXT line is rolled after the page has loaded and again after
//   every new line (never during render), so later lines still vary.
export function useBubbleLine(situation: BubbleSituation): string {
  const key = JSON.stringify(situation);
  const [current, setCurrent] = useState(() => ({ key, line: variants(situation)[0] }));
  const [roll, setRoll] = useState(0);

  // Roll a moment after each new line is on screen (a timer, like useLongWait below).
  useEffect(() => {
    const timer = setTimeout(() => setRoll(Math.random()), 0);
    return () => clearTimeout(timer);
  }, [current.key]);

  if (current.key !== key) {
    const line = pickLineWith(situation, current.line, roll);
    setCurrent({ key, line });
    return line;
  }
  return current.line;
}

// `value`, but only after it has stopped changing for `ms` (e.g. the goal while typing).
export function useSettledValue<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

// True once the same activity (e.g. "brew") has been running for `ms` (the 12-second hint).
export function useLongWait(activity: string | null, ms = 12_000): boolean {
  const [state, setState] = useState({ activity, slow: false });
  if (state.activity !== activity) setState({ activity, slow: false });

  useEffect(() => {
    if (!activity) return;
    const timer = setTimeout(() => setState((s) => (s.activity === activity ? { ...s, slow: true } : s)), ms);
    return () => clearTimeout(timer);
  }, [activity, ms]);

  return state.activity === activity && state.slow;
}
