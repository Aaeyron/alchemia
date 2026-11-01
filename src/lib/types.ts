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
