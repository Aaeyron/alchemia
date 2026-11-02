// Offline regression tests for POST /api/visualize after its helpers moved to src/lib/imageRules.ts
// and src/lib/ideaRules.ts (fake Muse Image, no network).
// Run (from the project folder):
//   node --import ./scripts/offline-tests/register.mjs --test scripts/offline-tests/*.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";
import { errorReply, fakeFetch, imageReply, post, promptOf } from "./fakeFetch";

const { POST } = await import("@/app/api/visualize/route");

const REQUEST = {
  idea: { title: "Bottle Pen Cup", description: "A pen cup.", materialsUsed: ["plastic bottle", "tape"] },
  ingredients: ["plastic bottle", "tape"],
  photos: ["data:image/jpeg;base64,UEhPVE8="],
  materials: [
    { name: "plastic bottle", color: "blue", material: "plastic", source: "photo" },
    { name: "tape", source: "typed" },
  ],
  roles: [{ ingredient: "plastic bottle", role: "the pen cup" }],
};

test("visualize: edit prompt still lists materials with colors and roles", async () => {
  const calls = fakeFetch(() => imageReply("T0s="));
  const res = await POST(post(REQUEST));
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  const prompt = promptOf(calls[0]);
  assert.match(prompt, /plastic bottle \(blue, plastic\), tape \(no color given\)/);
  assert.match(prompt, /plastic bottle is the pen cup/);
});

test("visualize: still retries with the plain prompt after a content-filter block", async () => {
  const calls = fakeFetch((_call, n) =>
    n === 1 ? errorReply(400, '{"error":{"code":"content_policy_violation"}}') : imageReply("T0s=")
  );
  const res = await POST(post(REQUEST));
  assert.equal(res.status, 200);
  assert.equal(calls.length, 2);
  assert.match(promptOf(calls[1]), /a simple DIY craft project/);
  assert.doesNotMatch(promptOf(calls[1]), /pen cup/);
});

test("visualize: bad roles are still a 400", async () => {
  fakeFetch(() => imageReply("T0s="));
  const res = await POST(post({ ...REQUEST, roles: [{ ingredient: "", role: "x" }] }));
  assert.equal(res.status, 400);
});
