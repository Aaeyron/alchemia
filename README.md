# 🧪 Alchemia

### Turn what you have into what you need.

Alchemia looks at the things around you, lets you pick your ingredients, and invents projects you can make with them, within your budget and time. Then it paints a concept picture of the result.

Built for the **Meta Global AI Developer Hackathon** · Track: **Indie Developer** · Problem statement: **Build for Your World**

- 💻 **Code:** https://github.com/Aaeyron/alchemia

> Alchemia is an independent hackathon project. It is not an official Meta product, and Meta does not endorse it.

## The problem

Picture a student with a project due tomorrow and ₱0 to spend. Most "what can I make?" tools suggest things that need more supplies. Alchemia only uses the ingredients you have. When you say "I don't have string," it redesigns the idea without it.

## How it works (5 steps)

| Step | Screen | What happens |
|---|---|---|
| 1 | 📸 **Show** | Upload up to 3 photos. Meta's models name each object, and tappable boxes appear on the photo. You can also type your own ingredients (up to 30 in total). |
| 2 | 🎯 **Need** | Say or type your goal, then pick a budget and a time limit. |
| 3 | 💡 **Ideas** | Three ideas appear. Plain code checks each one: only your ingredients, within budget, within time. |
| 4 | ✨ **See it** | A concept picture appears next to your photos. Tweak it with "I don't have…", "Make it weird" or "Make it easier", and use "Back to previous version" to undo. |
| 5 | 🛠️ **Build** | Step-by-step instructions and a safety note. |

Voice works in English, Tagalog and Taglish (for example "wala akong string" or "meron akong tape"), and with some Bisaya, which is less accurate.

## Which Meta models, and why

All models are called through the **Meta Model API**, only from server code, so the API key never reaches the browser.

| Model | Where it's used | Why |
|---|---|---|
| **Muse Spark 1.3** (`muse-spark-1.3`) | `/api/detect`, `/api/ideas`, `/api/tweak`, `/api/voice-intent` | Reads the photos and names the ingredients, writes the three ideas as structured JSON, redesigns ideas, and turns spoken sentences into actions |
| **SAM 3.1** (`sam-3.1`) | `/api/segment` | Finds each ingredient in the photo so you can tap the object itself. One request per ingredient name, for up to 8 detected objects per photo. |
| **Muse Image** (`muse-image-1.0`) | `/api/visualize` | Paints the concept picture. It starts from your real photos using the image-edit endpoint, and falls back to text-to-image if that fails. Image search, web search and shell tools are turned off for edits. |
| **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`) | `/api/transcribe` | Turns your voice into text. The browser records and converts the clip to 16 kHz mono WAV, a format the endpoint accepts. |

## Why the ideas can be trusted: checks in plain code

The AI suggests, but code verifies. After Muse Spark proposes an idea, deterministic code checks that:
1. every ingredient the idea uses is in your ingredient list,
2. the cost is within your budget,
3. the time is within your limit.

If an idea fails a check, Alchemia asks the model once more, naming the broken rule, and shows ✓ or ✗ stamps either way. Tweaks ("I don't have…", "Make it weird", "Make it easier") go through the same checks and the same single retry. Each ingredient's color is passed to the idea and picture prompts, so projects keep each ingredient's real color.

## Built during the hackathon

Everything in this repository was built **from Oct 31, 2026 onward**, during the hackathon's building period, and the commit history shows it. The only starting point was the standard scaffold from `create-next-app`, in the first commit.

New work in this repo includes: the 5-step flow, photo analysis, SAM tappable boxes, the shared ingredient list (photos and typed items), the idea checks, the concept picture pipeline, the three tweaks, voice input and its Taglish intent handling, progress animations, the design system and school-days theme, and the rate limiting.

**AI coding assistance:** much of the code was written with an AI coding assistant (Claude), directed, tested and reviewed by the author.

## Tech stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · Vercel

Third-party material: the packages above (open-source licenses) and the fonts **Fredoka** and **Patrick Hand** (Google Fonts, SIL Open Font License). All illustrations, the mascot and the doodles are original CSS and inline SVG made for this project. Emoji come from the user's device.

## Run it yourself

You need Node.js 22 and a Meta Model API key.

```bash
git clone https://github.com/Aaeyron/alchemia.git
cd alchemia
npm install
```

Create a file named `.env.local` in the project root:

```
MODEL_API_KEY=your-key-here
MODEL_API_BASE_URL=https://api.meta.ai/v1
MODEL_API_MODEL=muse-spark-1.3
```

Optional overrides: `MODEL_API_IMAGE_MODEL`, `MODEL_API_SAM_MODEL`, `MODEL_API_VOICE_MODEL`.

Then:

```bash
npm run dev
```

Open http://localhost:3000. The microphone only works on `localhost` or `https`. Never commit `.env.local`; it is in `.gitignore`.

## Safety, privacy and honesty

- **Concept pictures are AI-generated.** The real project may look different, and the app says so.
- **Ideas can be wrong.** Each idea carries a safety note. Ask a grown-up for help with sharp tools, heat or electricity.
- **Photos and voice clips** are sent to the Meta Model API to be processed. Alchemia has no database, and the app stores nothing in the browser. Muse Spark is called in Standard mode (`muse-spark-1.3`); Meta's documentation says content sent in Standard mode is not used to train its models. See Meta's own terms for the other models.
- **Basic abuse protection:** an in-memory per-IP hourly rate limit. On serverless hosting it resets when an instance restarts, so it is a basic safeguard only.

## Known limitations

- SAM 3.1 takes one concept per request, so boxes for many objects use several requests.
- Voice: Tagalog and code-switching are supported. Bisaya/Cebuano is not an officially supported language, so it may be less accurate.
- Small or overlapping objects may get no box. The ingredient chips are the dependable way to select.
- Ingredient names are matched with simple text matching, so unusual names may occasionally be matched too loosely or too strictly.
- At most 3 photos and 30 ingredients per session.

## License

MIT, see [LICENSE](LICENSE). The fonts (Fredoka, Patrick Hand) keep their own SIL Open Font License.

## Author

**Aaron Seth Nagtalon** · solo entry · GitHub: [@Aaeyron](https://github.com/Aaeyron)