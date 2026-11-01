"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";

// "Work in progress" visuals shown while the AI is busy. All movement is CSS (see the
// "Work-in-progress animations" section in globals.css); reduced-motion users get a
// still frame with the same text.

export type ProgressKind = "detect" | "segment" | "brew" | "paint" | "tweak" | "voice";

// Friendly messages that rotate while waiting. Honest: no fake percentages.
const MESSAGES: Record<ProgressKind, string[]> = {
  detect: ["Looking at your photo…", "Spotting the ingredients…", "Naming each thing…", "Almost got them all…"],
  segment: ["Finding the edges…", "Drawing little boxes…", "Tracing the shapes…", "Lining things up…"],
  brew: [
    "Bubbling up ideas…",
    "Stirring in your ingredients…",
    "Adding a pinch of creativity…",
    "Checking the rules (budget, time, ingredients)…",
    "Picking the best three…",
  ],
  paint: ["Mixing the colors…", "Sketching your concept picture…", "Keeping your real colors…", "Adding the final touches…"],
  tweak: ["Waving the wand…", "Rearranging the pieces…", "Making it just right…", "Double-checking the rules…"],
  voice: ["Writing it down…", "Thinking about what you said…", "Almost there…"],
};

const ICONS: Record<ProgressKind, string> = {
  detect: "🔎",
  segment: "🔎",
  brew: "🧪",
  paint: "🖌️",
  tweak: "🪄",
  voice: "🎙️",
};

const PANEL_COLORS: Record<ProgressKind, string> = {
  detect: "bg-sky-soft",
  segment: "bg-sky-soft",
  brew: "bg-lavender-soft",
  paint: "bg-pink-soft",
  tweak: "bg-white",
  voice: "bg-white",
};

const ROTATE_MS = 2500;
const SLOW_MS = 12_000;
const VERY_SLOW_MS = 30_000;
const SLOW_HINTS = [
  "Still working. Good ideas take a moment!",
  "This is taking longer than usual. You can keep waiting, or try again in a little while.",
];

type BrewProgressProps = {
  kind: ProgressKind;
  compact?: boolean; // small inline version (icon + text)
  emojis?: string[]; // brew: the selected ingredients' emojis (up to 6 hop into the pot)
  photo?: string; // detect / segment: the photo being looked at
  hideText?: boolean; // visual only (the caller already shows its own text)
};

export function BrewProgress({ kind, compact = false, emojis = [], photo, hideText = false }: BrewProgressProps) {
  const messages = MESSAGES[kind];
  const [index, setIndex] = useState(0);
  const [slowness, setSlowness] = useState(0); // 0 = normal, 1 = >12 s, 2 = >30 s

  useEffect(() => {
    const rotate = setInterval(() => setIndex((i) => (i + 1) % messages.length), ROTATE_MS);
    const slow = setTimeout(() => setSlowness(1), SLOW_MS);
    const verySlow = setTimeout(() => setSlowness(2), VERY_SLOW_MS);
    return () => {
      clearInterval(rotate);
      clearTimeout(slow);
      clearTimeout(verySlow);
    };
  }, [messages.length]);

  // Screen readers hear the first message and the "taking a while" hints, not every rotation.
  const status = hideText ? null : (
    <div role="status" aria-live="polite" className={compact ? "min-w-0" : "w-full text-center"}>
      <span className="sr-only">{messages[0]}</span>
      <p
        key={index}
        aria-hidden="true"
        className={`wip-message ${
          compact
            ? "truncate text-base font-medium"
            : "flex min-h-14 items-center justify-center text-xl font-semibold" // room for 2 lines, so nothing jumps
        }`}
      >
        {messages[index]}
      </p>
      {SLOW_HINTS.slice(0, slowness).map((hint) => (
        <p key={hint} className="hint">
          {hint}
        </p>
      ))}
    </div>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {kind === "voice" ? (
          <VoiceWave />
        ) : (
          <span aria-hidden="true" className="wip wip-wave inline-block text-2xl">
            {ICONS[kind]}
          </span>
        )}
        {status}
      </div>
    );
  }

  return (
    <div className={`panel items-center ${PANEL_COLORS[kind]}`}>
      {kind === "brew" && <BrewScene emojis={emojis} />}
      {kind === "paint" && <PaintScene />}
      {kind === "tweak" && <TweakScene />}
      {(kind === "detect" || kind === "segment") && <ScanScene photo={photo} />}
      {kind === "voice" && <VoiceWave />}
      {status}
    </div>
  );
}

// ---------- Scenes (decorative, hidden from screen readers) ----------

const BREW_BUBBLES = [
  { x: -30, size: 14, color: "bg-pink", duration: 2, delay: 0 },
  { x: -10, size: 20, color: "bg-sky", duration: 2.6, delay: 0.5 },
  { x: 12, size: 12, color: "bg-sunny", duration: 1.8, delay: 1 },
  { x: 28, size: 18, color: "bg-mint", duration: 2.3, delay: 0.3 },
  { x: 0, size: 10, color: "bg-lavender", duration: 1.6, delay: 1.3 },
  { x: -22, size: 16, color: "bg-sunny", duration: 2.8, delay: 1.7 },
];
const HOP_FROM_X = [-100, 100, -70, 70, -120, 120]; // where each ingredient starts, left/right of the pot
const BREW_SPARKLES = [
  { left: "8%", top: "12%", delay: 0 },
  { left: "86%", top: "8%", delay: 1.1 },
  { left: "14%", top: "52%", delay: 2.2 },
  { left: "82%", top: "48%", delay: 0.6 },
];

// The mascot cauldron bubbling, with ingredient emojis hopping in one after another.
function BrewScene({ emojis }: { emojis: string[] }) {
  return (
    <div aria-hidden="true" className="relative h-56 w-64">
      {BREW_SPARKLES.map((s, i) => (
        <span key={i} className="sparkle text-lg" style={{ left: s.left, top: s.top, animationDelay: `${s.delay}s` }}>
          ✨
        </span>
      ))}
      {BREW_BUBBLES.map((b, i) => (
        <span
          key={i}
          className={`wip wip-rise absolute rounded-full border-2 border-ink/50 ${b.color}`}
          style={{
            left: `calc(50% + ${b.x}px)`,
            bottom: 80,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
      {emojis.slice(0, 6).map((emoji, i) => (
        <span
          key={i}
          className="wip wip-hop absolute text-2xl"
          style={
            {
              left: "calc(50% - 0.75rem)",
              bottom: 70,
              animationDelay: `${i * 0.4}s`,
              "--from-x": `${HOP_FROM_X[i]}px`,
            } as React.CSSProperties
          }
        >
          {emoji}
        </span>
      ))}
      {/* Drawn last, so ingredients look like they drop into the pot. */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
        <Mascot size={130} bubbling />
      </div>
    </div>
  );
}

const DABS = [
  { x: 15, y: 20, size: 34, color: "bg-pink", delay: 0 },
  { x: 55, y: 15, size: 26, color: "bg-sky", delay: 0.5 },
  { x: 30, y: 55, size: 40, color: "bg-mint", delay: 1 },
  { x: 65, y: 60, size: 30, color: "bg-sunny", delay: 1.5 },
  { x: 45, y: 35, size: 22, color: "bg-lavender", delay: 2 },
];

// An empty polaroid with a brush sweeping across and pastel dabs appearing.
function PaintScene() {
  return (
    <div aria-hidden="true" className="sticker w-48 -rotate-1 bg-white p-3 pb-2">
      <div className="relative aspect-square overflow-hidden rounded-control bg-sky-soft">
        {DABS.map((d, i) => (
          <span
            key={i}
            className={`wip wip-dab absolute rounded-full ${d.color}`}
            style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.size, height: d.size, animationDelay: `${d.delay}s` }}
          />
        ))}
        <span className="wip wip-sweep absolute left-1 top-1 text-3xl">🖌️</span>
      </div>
      <p className="caption mt-1 text-center">After ✨</p>
    </div>
  );
}

// A little idea card with a waving wand and sparkles circling around it.
function TweakScene() {
  return (
    <div aria-hidden="true" className="relative h-36 w-56">
      <div className="sticker paper absolute inset-6 flex rotate-1 flex-col gap-2 p-3 pl-10">
        <span className="h-2.5 w-3/4 rounded-full bg-ink/25" />
        <span className="h-2.5 w-1/2 rounded-full bg-ink/25" />
        <span className="h-2.5 w-2/3 rounded-full bg-ink/25" />
      </div>
      <div className="wip wip-spin absolute inset-0">
        <span className="sparkle left-1/2 top-0 text-lg">✨</span>
        <span className="sparkle bottom-0 left-1/3 text-base" style={{ animationDelay: "1s" }}>
          ✨
        </span>
        <span className="sparkle left-0 top-1/2 text-base" style={{ animationDelay: "2s" }}>
          ✨
        </span>
        <span className="sparkle right-2 top-1/3 text-lg" style={{ animationDelay: "3s" }}>
          ✨
        </span>
      </div>
      <span className="wip wip-wave absolute -right-1 -top-2 text-4xl">🪄</span>
    </div>
  );
}

// The photo (or a pastel placeholder) with a soft scanning line and a gliding magnifying glass.
function ScanScene({ photo }: { photo?: string }) {
  return (
    <div aria-hidden="true" className="sticker w-48 rotate-1 bg-white p-2">
      <div className="relative h-32 overflow-hidden rounded-lg bg-sky-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="" className="h-full w-full object-cover opacity-80" />}
        <span className="wip wip-scan absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-sky/0 via-sky/70 to-sky/0" />
        <span className="wip wip-glide absolute left-1 top-1 text-3xl">🔎</span>
      </div>
    </div>
  );
}

// Three bouncing dots and a small sound wave of bars.
function VoiceWave() {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-2">
      <span className="inline-flex h-6 items-center gap-0.5">
        {[0, 0.15, 0.3, 0.45, 0.6].map((delay) => (
          <span key={delay} className="wip wip-bar h-full w-1.5 rounded-full bg-ink/70" style={{ animationDelay: `${delay}s` }} />
        ))}
      </span>
      <span className="inline-flex items-center gap-1">
        {[0, 0.2, 0.4].map((delay) => (
          <span key={delay} className="wip wip-dot h-2 w-2 rounded-full bg-ink" style={{ animationDelay: `${delay}s` }} />
        ))}
      </span>
    </span>
  );
}
