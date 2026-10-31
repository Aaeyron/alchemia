import { transcribeAudio } from "@/lib/meta";

// Our clips are at most 15 seconds of 16 kHz mono 16-bit WAV (about 0.5 MB), so 3 MB is plenty.
// (Meta's own limit is 32 MB / 10 minutes.)
const MAX_BYTES = 3 * 1024 * 1024;
const WAV_TYPES = ["audio/wav", "audio/x-wav", "audio/wave"];

// Taglish / Tagalog / Bisaya words we want heard correctly, plus the app's name.
const EXTRA_KEYWORDS = ["Alchemia", "wala", "meron", "pesos", "piso", "lang", "naa", "wala koy"];

// Does the file start like a WAV file ("RIFF....WAVE")?
async function looksLikeWav(file: Blob): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const text = String.fromCharCode(...header);
  return text.startsWith("RIFF") && text.slice(8, 12) === "WAVE";
}

// Optional "keywords" form field: a JSON array of strings (e.g. the ingredient names).
function readKeywords(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((word): word is string => typeof word === "string")
      .map((word) => word.trim().slice(0, 40))
      .filter((word) => word !== "")
      .slice(0, 30);
  } catch {
    return [];
  }
}

// POST /api/transcribe — multipart form: "audio" (a WAV file) and optional "keywords" (JSON array)
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Please send the recording as multipart form data." }, { status: 400 });
  }

  const audio = form.get("audio");
  const isWav =
    audio instanceof Blob &&
    WAV_TYPES.includes(audio.type) &&
    audio.size > 44 &&
    audio.size <= MAX_BYTES &&
    (await looksLikeWav(audio));
  if (!isWav) {
    return Response.json({ error: "Please send a short WAV recording (up to 3 MB)." }, { status: 400 });
  }

  const keywords = [...readKeywords(form.get("keywords")), ...EXTRA_KEYWORDS];

  try {
    const wav = new Blob([await audio.arrayBuffer()], { type: "audio/wav" });
    const text = await transcribeAudio(wav, keywords);
    return Response.json({ text });
  } catch (err) {
    console.error("transcribe failed:", err);
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return Response.json({ error: message }, { status: 500 });
  }
}
