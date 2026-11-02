// Types shared by the API routes and the page (safe to import in client code).

// What the user asked for by voice (from /api/voice-intent, already cleaned up).
export type VoiceIntent = {
  intent: "set_goal" | "add_items" | "missing" | "weird" | "easier" | "none";
  goal?: string;
  items?: string[];
  budgetPhp?: number; // snapped to 0 / 50 / 100 / 500
  timeMinutes?: number; // snapped to 5 / 10 / 30 / 60
};

// One item in the shared ingredient list: seen in a photo, or typed in by the user.
export type Ingredient = {
  id: string;
  name: string;
  source: "photo" | "typed";
  photoId?: string; // which photo it was first seen in
  color?: string; // e.g. "blue" (from detection, or a color word in a typed name)
  material?: string; // e.g. "plastic" (from detection)
};

// One material an idea uses, with what we know about it (sent to /api/visualize).
export type MaterialInfo = {
  name: string;
  color?: string;
  material?: string;
  source: "photo" | "typed";
};

// One uploaded photo (already downscaled) and the boxes SAM found in it.
export type UploadedPhoto = {
  id: string;
  dataUrl: string;
  boxes: PhotoBox[];
};

// A box around an object in the uploaded photo (from SAM via /api/segment).
// x, y (top-left corner), w and h are fractions of the photo's width/height, from 0 to 1.
export type PhotoBox = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
};

// Results of the plain-code checks the server runs on each idea.
export type IdeaChecks = {
  materials: boolean; // only uses the selected ingredients
  budget: boolean; // costPhp <= budget
  time: boolean; // timeMinutes <= time limit
  usesAll: boolean; // no cauldron ingredient is skipped (only a rule when "use everything" is on)
};

// What one used ingredient becomes in the finished project, e.g. { "plastic bottle", "the pen cup" }.
export type IngredientRole = { ingredient: string; role: string };

// A cauldron ingredient the idea doesn't use, and why.
export type SkippedIngredient = { ingredient: string; reason: string };

// Counted in plain code from materialsUsed (not the model's own count).
export type IdeaUsage = {
  usedCount: number;
  totalCount: number; // how many ingredients were in the cauldron
  skippedNames: string[];
};

// What /api/check-picture found when comparing a concept picture with the idea's ingredients.
export type PictureCheck = {
  matched: string[]; // ingredients that can be seen in the picture
  missing: string[]; // ingredients that can't clearly be seen
  extras: string[]; // things in the picture that aren't in the cauldron
};

// One step of the Build Mode guide (from /api/guide, already cleaned up in code).
// Ingredient and tool names are exact cauldron names.
export type GuideStep = {
  title: string;
  instruction: string;
  ingredients: string[]; // what this step uses as parts of the project
  tools: string[]; // cauldron items used as tools in this step (may be empty)
  tip: string; // "" if none
  safety: string; // "" if the step needs no extra care
  minutes: number;
  difficulty: 1 | 2 | 3;
  result: string; // how the project looks after this step ("" in the simple guide)
};

// The Build Preview numbers, counted in code from the steps (not by the model).
export type GuideOverview = {
  totalMinutes: number;
  stepCount: number;
  ingredients: string[]; // every step ingredient, in recipe order
  tools: string[];
  maxDifficulty: 1 | 2 | 3;
  safetySteps: number[]; // step numbers (from 1) with a safety note
};

export type BuildGuide = {
  steps: GuideStep[];
  fallback: boolean; // true = the simple guide made from the idea's own buildSteps
  overview: GuideOverview;
};

// The painted picture of one build step (from /api/step-image).
export type StepImageState = {
  status: "painting" | "done" | "failed";
  image?: string; // when done
  tries: number; // paid attempts so far (1 automatic + up to 2 "Try painting" taps)
};

// Build Mode for one version of the idea (a tweak or a new picture makes a new version).
export type BuildState = {
  idea: Idea; // the version this guide belongs to
  picture: string | null; // that version's concept picture (null if there is none)
  reference: string | null; // the same picture, downscaled once, sent to /api/step-image
  guide: BuildGuide;
  started: boolean; // false = still on the Build Preview
  current: number; // index of the step on screen
  done: boolean[]; // checkmarks, one per step
  stepImages: Record<number, StepImageState>; // by step index; only steps that were opened (or are next)
};

export type Idea = {
  title: string;
  emoji: string;
  description: string;
  materialsUsed: string[];
  timeMinutes: number;
  costPhp: number;
  difficulty: 1 | 2 | 3;
  safetyNote: string;
  buildSteps: string[];
  // The recipe: every cauldron ingredient is in exactly one of these two lists
  // (names are the exact cauldron names, cleaned up in code on the server).
  roles: IngredientRole[];
  skipped: SkippedIngredient[];
  usage: IdeaUsage;
  checks: IdeaChecks;
};
