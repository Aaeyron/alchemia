"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Mascot } from "@/components/Mascot";

// Bubbles and its speech bubble. The bubble pops in, then the line types out letter by letter
// while Bubbles "talks". Tap the bubble (or Enter/Space) to show the whole line at once.
// A new line cuts the old one cleanly, the bubble wiggles, and the new line types out.
// Reduced motion: no pop, no typing, no talking; the full line shows at once.

const CHARS_PER_SECOND = 35;

type SpeechBubbleProps = {
  line: string;
  bubbling: boolean; // a request is running: the mascot bobs
  cheer?: boolean; // a one-time happy jump (step 5)
};

// Does the user ask for less motion? (false on the server)
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false
  );
}

export function SpeechBubble({ line, bubbling, cheer = false }: SpeechBubbleProps) {
  const reducedMotion = useReducedMotion();
  // `count` letters of `line` are visible; `changes` counts new lines since the bubble appeared.
  const [typed, setTyped] = useState({ line, count: 0, changes: 0 });
  if (typed.line !== line) {
    // A new line: drop the old one (even mid-typing) and start typing the new one.
    setTyped({ line, count: 0, changes: typed.changes + 1 });
  }

  const count = reducedMotion ? line.length : Math.min(typed.count, line.length);
  const typing = count < line.length;

  // One more letter every ~30 ms until the line is complete.
  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(
      () => setTyped((t) => (t.line === line ? { ...t, count: t.count + 1 } : t)),
      1000 / CHARS_PER_SECOND
    );
    return () => clearTimeout(timer);
  }, [typing, count, line]);

  function finishTyping() {
    setTyped((t) => ({ ...t, count: t.line.length }));
  }

  // Pop in the first time; wiggle on every new line. Two identical wiggle animations
  // take turns, so switching between them restarts the wiggle.
  const motion = typed.changes === 0 ? "speech-pop" : typed.changes % 2 === 1 ? "speech-wiggle-a" : "speech-wiggle-b";

  return (
    <div className="flex items-center gap-3">
      <div className={`shrink-0 ${cheer ? "mascot-cheer" : ""}`}>
        <Mascot size={80} bubbling={bubbling} talking={typing} />
      </div>

      <button
        type="button"
        onClick={finishTyping}
        tabIndex={typing ? 0 : -1}
        aria-label={typing ? `Bubbles says: ${line} (press to show it all)` : `Bubbles says: ${line}`}
        className={`sticker caption relative bg-white px-4 py-2 text-left text-2xl ${motion} ${
          typing ? "cursor-pointer" : "cursor-default"
        }`}
      >
        {/* Tail pointing at the mascot */}
        <span
          aria-hidden="true"
          className="absolute top-1/2 -left-[11px] h-4 w-4 -translate-y-1/2 rotate-45 border-b-3 border-l-3 border-ink bg-white"
        />
        {/* The full line, invisible, holds the bubble's final size while the visible copy types out. */}
        <span aria-hidden="true" className="grid">
          <span className="invisible col-start-1 row-start-1">{line}</span>
          <span className="col-start-1 row-start-1">
            {line.slice(0, count)}
            {typing && <span className="speech-caret">▌</span>}
          </span>
        </span>
      </button>

      {/* Screen readers hear each new line once, as a whole. The first line of a step isn't
          announced here, so it never talks over the "Step 2 of 5: Need" announcement. */}
      <p aria-live="polite" className="sr-only">
        {typed.changes > 0 ? line : ""}
      </p>
    </div>
  );
}
