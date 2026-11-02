// Offline tests for POST /api/guide (fake Muse Spark, no network).
// Run (from the project folder):
//   node --import ./scripts/offline-tests/register.mjs --test scripts/offline-tests/*.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";
import { errorReply, fakeFetch, post, promptOf, sparkReply } from "./fakeFetch";
import type { BuildGuide } from "@/lib/types";

// Imported after fakeFetch, which sets the fake key that meta.ts reads.
const { POST } = await import("@/app/api/guide/route");

const INGREDIENTS = ["plastic bottle", "cardboard", "tape", "ruler"];

const REQUEST = {
  idea: {
    title: "Bottle Pen Cup",
    description: "A pen cup made from a bottle on a cardboard base.",
    materialsUsed: ["plastic bottle", "cardboard", "tape"],
    roles: [
      { ingredient: "cardboard", role: "the base" },
      { ingredient: "plastic bottle", role: "the pen cup" },
      { ingredient: "tape", role: "the glue" },
    ],
    buildSteps: ["Cut the bottle in half.", "Tape it onto the cardboard.", "Put your pens in."],
    safetyNote: "Cut edges can be sharp.",
    timeMinutes: 15,
    difficulty: 2,
  },
  ingredients: INGREDIENTS,
};

// A good step, with any fields replaced.
function step(fields: Record<string, unknown> = {}) {
  return {
    title: "Do a thing",
    instruction: "Do the thing. Then check it.",
    ingredients: ["plastic bottle"],
    tools: [],
    tip: "Go slowly.",
    safety: "",
    minutes: 5,
    difficulty: 1,
    result: "The bottle stands on the table.",
    ...fields,
  };
}

test("valid guide: one Spark call, cleaned steps, overview counted in code", async () => {
  const calls = fakeFetch(() =>
    sparkReply({
      steps: [
        step({ title: "Cut the bottle", ingredients: ["Plastic Bottle"], tools: ["ruler"], safety: "Ask a grown-up to help.", difficulty: 2 }),
        step({ title: "Tape it down", ingredients: ["tape", "cardboard"], minutes: 4.6 }),
        step({ title: "Fill it up", ingredients: [], minutes: 3, result: "x".repeat(300) }),
      ],
    })
  );

  const res = await POST(post(REQUEST));
  assert.equal(res.status, 200);
  const guide = (await res.json()) as BuildGuide;

  assert.equal(calls.length, 1, "no retry needed");
  assert.equal(guide.fallback, false);
  assert.equal(guide.steps.length, 3);
  assert.deepEqual(guide.steps[0].ingredients, ["plastic bottle"], "snapped to the exact cauldron name");
  assert.deepEqual(guide.steps[0].tools, ["ruler"]);
  assert.equal(guide.steps[1].minutes, 5, "minutes rounded to a whole number");
  assert.equal(guide.steps[2].result.length, 200, "result capped at 200 characters");
  assert.deepEqual(guide.overview, {
    totalMinutes: 13, // 5 + 5 (4.6 rounded) + 3
    stepCount: 3,
    ingredients: ["cardboard", "plastic bottle", "tape"], // recipe order (the roles)
    tools: ["ruler"],
    maxDifficulty: 2,
    safetySteps: [1],
  });

  const prompt = promptOf(calls[0]);
  assert.match(prompt, /You write clear, friendly build guides for students\./);
  assert.match(prompt, /Ingredient list \(the ONLY materials available\): plastic bottle, cardboard, tape, ruler/);
  assert.match(prompt, /"result": "The bottle is cut in half;/, "few-shot example has the new fields");
});

test("unknown ingredient: dropped, and Spark is asked once more naming it", async () => {
  const calls = fakeFetch((_call, n) =>
    sparkReply({
      steps:
        n === 1
          ? [step({ ingredients: ["plastic bottle", "glue gun"] }), step(), step()]
          : [step(), step({ ingredients: ["tape"] }), step()],
    })
  );

  const guide = (await (await POST(post(REQUEST))).json()) as BuildGuide;
  assert.equal(calls.length, 2, "exactly one retry");
  assert.match(promptOf(calls[1]), /Step 1 uses "glue gun", which is not in the ingredient list\./);
  assert.match(promptOf(calls[1]), /Your previous answer was:/);
  assert.equal(guide.fallback, false);
  assert.deepEqual(guide.steps[1].ingredients, ["tape"], "the retry's answer is used");
});

test("unknown tool: Spark is asked once more naming the tool", async () => {
  const calls = fakeFetch((_call, n) =>
    sparkReply({ steps: n === 1 ? [step({ tools: ["scissors"] }), step(), step()] : [step(), step(), step()] })
  );

  const guide = (await (await POST(post(REQUEST))).json()) as BuildGuide;
  assert.equal(calls.length, 2);
  assert.match(promptOf(calls[1]), /Step 1 uses the tool "scissors", which is not in the ingredient list\./);
  assert.deepEqual(guide.steps[0].tools, []);
});

test("still broken after the retry: the cleaned retry is returned, with unknown names dropped", async () => {
  const calls = fakeFetch(() => sparkReply({ steps: [step({ ingredients: ["glue gun", "tape"] }), step(), step()] }));

  const guide = (await (await POST(post(REQUEST))).json()) as BuildGuide;
  assert.equal(calls.length, 2, "never more than one retry");
  assert.deepEqual(guide.steps[0].ingredients, ["tape"]);
});

test("too few steps: retried with the count rule named", async () => {
  const calls = fakeFetch((_call, n) => sparkReply({ steps: n === 1 ? [step(), step()] : [step(), step(), step(), step()] }));

  const guide = (await (await POST(post(REQUEST))).json()) as BuildGuide;
  assert.equal(calls.length, 2);
  assert.match(promptOf(calls[1]), /You returned 2 steps instead of 3 to 8\./);
  assert.equal(guide.steps.length, 4);
});

test("total failure: both calls fail, so the simple guide is built from buildSteps", async () => {
  const calls = fakeFetch(() => errorReply(503));

  const res = await POST(post(REQUEST));
  assert.equal(res.status, 200);
  const guide = (await res.json()) as BuildGuide;
  assert.equal(calls.length, 2);
  assert.equal(guide.fallback, true);
  assert.deepEqual(
    guide.steps.map((s) => s.instruction),
    REQUEST.idea.buildSteps
  );
  assert.equal(guide.steps[0].safety, "Cut edges can be sharp.", "the cutting step gets the idea's safety note");
  assert.equal(guide.steps[1].safety, "");
  assert.ok(guide.steps.every((s) => s.result === "" && s.tip === ""), "no tips, no step pictures");
  assert.equal(guide.overview.totalMinutes, 15);
});

test("not JSON twice: also the simple guide", async () => {
  fakeFetch(() => sparkReply("Sorry, I can't help with that."));
  const guide = (await (await POST(post(REQUEST))).json()) as BuildGuide;
  assert.equal(guide.fallback, true);
});

test("bad input: 400 with a friendly message, and no Spark call", async () => {
  const calls = fakeFetch(() => sparkReply({ steps: [] }));
  for (const body of [{}, { ...REQUEST, ingredients: [] }, { ...REQUEST, idea: { ...REQUEST.idea, title: "" } }, "not json"]) {
    const res = await POST(post(body));
    assert.equal(res.status, 400);
    assert.equal(typeof ((await res.json()) as { error: unknown }).error, "string");
  }
  assert.equal(calls.length, 0);
});
