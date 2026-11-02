// Offline tests for POST /api/step-image (fake Muse Image, no network).
// Run (from the project folder):
//   node --import ./scripts/offline-tests/register.mjs --test scripts/offline-tests/*.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";
import { errorReply, fakeFetch, imageReply, post, promptOf } from "./fakeFetch";

// Imported after fakeFetch, which sets the fake key that meta.ts reads.
const { POST } = await import("@/app/api/step-image/route");

const PICTURE = "data:image/jpeg;base64,Q09OQ0VQVA=="; // stand-ins, not real pictures
const PHOTO = "data:image/jpeg;base64,UEhPVE8=";
const BLOCKED = '{"error":{"code":"content_policy_violation","param":"prompt"}}';

const REQUEST = {
  picture: PICTURE,
  photo: PHOTO,
  step: {
    title: "Tape the cup down",
    result: "The bottle cup stands on the brown cardboard base, taped at the bottom.",
    ingredients: ["tape", "cardboard"],
  },
  stepNumber: 2,
  totalSteps: 5,
  materials: [
    { name: "plastic bottle", color: "blue", material: "plastic", source: "photo" },
    { name: "cardboard", color: "brown", source: "photo" },
    { name: "tape", source: "typed" },
  ],
  title: "Bottle Pen Cup",
};

test("ok: one edit with the concept picture and the photo, full prompt", async () => {
  const calls = fakeFetch(() => imageReply("U1RFUDI="));

  const res = await POST(post(REQUEST));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { image: "data:image/webp;base64,U1RFUDI=" });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/images\/edits$/);
  assert.deepEqual(calls[0].body.images, [{ image_url: PICTURE }, { image_url: PHOTO }]);
  assert.deepEqual(calls[0].body.tool_enablement, { enable_image_search: false, enable_web_search: false, enable_shell: false });

  const prompt = promptOf(calls[0]);
  assert.match(prompt, /^Show a progress photo of the project "Bottle Pen Cup" at step 2 of 5: The bottle cup stands/);
  assert.match(prompt, /This is a partly finished version of the object in the reference picture\./);
  assert.match(prompt, /plastic bottle \(blue, plastic\), cardboard \(brown\), tape \(no color given\)/);
  assert.match(prompt, /No people, no hands, no text, no logos\./);
  assert.match(prompt, /the second is the student's real ingredients/);
});

test("blocked by the content filter, then ok with the plain prompt (no title)", async () => {
  const calls = fakeFetch((_call, n) => (n === 1 ? errorReply(400, BLOCKED) : imageReply("UExBSU4=")));

  const res = await POST(post(REQUEST));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { image: "data:image/webp;base64,UExBSU4=" });

  assert.equal(calls.length, 2);
  const plain = promptOf(calls[1]);
  assert.match(plain, /^Show a progress photo of a partly finished DIY craft project: The bottle cup stands/);
  assert.doesNotMatch(plain, /Bottle Pen Cup/, "the plain prompt has no title");
  assert.match(plain, /cardboard \(brown\)/, "the materials stay");
});

test("failing: one retry on 5xx, then a friendly 500 with no technical details", async () => {
  const calls = fakeFetch(() => errorReply(503, "upstream exploded"));

  const res = await POST(post(REQUEST));
  assert.equal(res.status, 500);
  const { error } = (await res.json()) as { error: string };
  assert.equal(error, "Alchemia couldn't paint this step right now. Please try again.");
  assert.equal(calls.length, 2, "one retry for a temporary error, no more");
});

test("blocked twice: a friendly 500 after exactly one plain-prompt try", async () => {
  const calls = fakeFetch(() => errorReply(400, BLOCKED));
  const res = await POST(post(REQUEST));
  assert.equal(res.status, 500);
  assert.equal(calls.length, 2);
});

test("sentences about people or hands are left out of the prompt", async () => {
  const calls = fakeFetch(() => imageReply("T0s="));
  const step = { ...REQUEST.step, result: "The cup sits on the base. A child holds it with both hands!" };
  await POST(post({ ...REQUEST, step }));

  const prompt = promptOf(calls[0]);
  assert.match(prompt, /at step 2 of 5: The cup sits on the base\.\n/);
  assert.doesNotMatch(prompt, /child|holds it/);
});

test("only people in the result: the step title is used instead", async () => {
  const calls = fakeFetch(() => imageReply("T0s="));
  const step = { ...REQUEST.step, result: "Your hands press the tape flat." };
  await POST(post({ ...REQUEST, step }));
  assert.match(promptOf(calls[0]), /at step 2 of 5: Tape the cup down\n/);
});

test("no photo: only the concept picture is sent", async () => {
  const calls = fakeFetch(() => imageReply("T0s="));
  await POST(post({ ...REQUEST, photo: undefined }));
  assert.deepEqual(calls[0].body.images, [{ image_url: PICTURE }]);
  assert.doesNotMatch(promptOf(calls[0]), /second is the student's/);
});

test("bad input: 400 with a friendly message, and no Muse Image call", async () => {
  const calls = fakeFetch(() => imageReply("T0s="));
  const bad = [
    { ...REQUEST, picture: "http://example.com/a.png" }, // not https and not a data URL
    { ...REQUEST, photo: "https://example.com/photo.png" }, // the photo must be a data URL
    { ...REQUEST, stepNumber: 6 }, // past the last step
    { ...REQUEST, totalSteps: 9 },
    { ...REQUEST, step: { ...REQUEST.step, result: "  " } },
    { ...REQUEST, title: "" },
    "not json",
  ];
  for (const body of bad) {
    const res = await POST(post(body));
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 80));
  }
  assert.equal(calls.length, 0);
});
