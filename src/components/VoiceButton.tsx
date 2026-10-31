"use client";

import { useEffect, useRef, useState } from "react";
import { BrewProgress } from "@/components/BrewProgress";
import { recordingToWav } from "@/lib/wav";

const MAX_SECONDS = 15;
const MESSAGE_SECONDS = 7; // how long "You said: …" stays visible

type Phase = "idle" | "listening" | "writing" | "thinking";

type VoiceButtonProps = {
  disabled: boolean; // can't START while something else is running (an active recording can still stop)
  keywords: string[]; // words to help the transcriber, e.g. ingredient names
  onActiveChange: (active: boolean) => void; // tells the page a voice request is running
  // Handles what was heard and returns a short friendly reply to show, e.g. "Added tape!".
  onText: (text: string) => Promise<string>;
};

const LABELS: Record<Phase, string> = {
  idle: "🎤 Tell Alchemia",
  listening: "⏹️ Listening… tap to stop",
  writing: "✍️ Writing it down…",
  thinking: "🧠 Thinking…",
};

// Tap to record (up to 15 s), tap again to stop. The clip is turned into WAV in the browser,
// sent to /api/transcribe, and the text goes to `onText`.
export function VoiceButton({ disabled, keywords, onActiveChange, onText }: VoiceButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always call the latest props, even from inside the recorder callbacks.
  const latest = useRef({ keywords, onText, onActiveChange });
  useEffect(() => {
    latest.current = { keywords, onText, onActiveChange };
  });

  // Show a message under the button for a few seconds.
  function show(newHeard: string | null, newReply: string | null) {
    setHeard(newHeard);
    setReply(newReply);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setHeard(null);
      setReply(null);
    }, MESSAGE_SECONDS * 1000);
  }

  function finish(newHeard: string | null, newReply: string) {
    show(newHeard, newReply);
    setPhase("idle");
    latest.current.onActiveChange(false);
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      show(null, "Voice needs a secure page (https or localhost). You can still type!");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      show(null, "Alchemia can't hear you: the microphone is blocked. You can still type!");
      return;
    }

    const chunks: Blob[] = [];
    const mediaRecorder = new MediaRecorder(stream); // the browser's own format (WebM or MP4)
    mediaRecorder.ondataavailable = (event) => chunks.push(event.data);
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop()); // turn the mic light off
      handleRecording(new Blob(chunks, { type: mediaRecorder.mimeType }));
    };

    recorder.current = mediaRecorder;
    mediaRecorder.start();
    setPhase("listening");
    show(null, null);
    latest.current.onActiveChange(true);
    stopTimer.current = setTimeout(stop, MAX_SECONDS * 1000);
  }

  function stop() {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
  }

  async function handleRecording(recording: Blob) {
    setPhase("writing");
    try {
      const { wav, seconds } = await recordingToWav(recording);
      if (seconds < 0.3) return finish(null, "That was too short. Tap, talk, then tap again!");

      const form = new FormData();
      form.append("audio", wav, "voice.wav");
      form.append("keywords", JSON.stringify(latest.current.keywords));
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't write that down.");

      const text: string = data.text;
      if (text === "") return finish(null, "I didn't hear anything. Try again, a little louder?");

      setPhase("thinking");
      show(text, null);
      finish(text, await latest.current.onText(text));
    } catch (err) {
      console.error("voice failed:", err);
      finish(null, "Oops! Something went wrong with the microphone. Try again, or just type.");
    }
  }

  // Stop everything if the button disappears mid-recording.
  useEffect(() => {
    return () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
    };
  }, []);

  const listening = phase === "listening";
  // Starting needs everything else to be idle; stopping is always allowed.
  const buttonDisabled = listening ? false : phase !== "idle" || disabled;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={buttonDisabled}
        aria-pressed={listening}
        className={`sticker pressable min-h-14 px-5 py-2 text-lg font-bold disabled:pointer-events-none disabled:opacity-50 ${
          listening ? "bg-pink motion-safe:animate-pulse" : "bg-lavender"
        }`}
      >
        {LABELS[phase]}
      </button>

      {/* Little sound wave + dots while listening, writing or thinking (the button keeps its text). */}
      {phase !== "idle" && (
        <div className="flex justify-center">
          <BrewProgress kind="voice" compact hideText />
        </div>
      )}

      <div role="status" aria-live="polite" className="text-base">
        {heard && (
          <p>
            <strong>You said:</strong> “{heard}”
          </p>
        )}
        {reply && <p className="font-medium">{reply}</p>}
      </div>
    </div>
  );
}
