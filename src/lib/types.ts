// Types shared by the API routes and the page (safe to import in client code).

// Results of the plain-code checks the server runs on each idea.
export type IdeaChecks = {
  materials: boolean; // only uses the selected ingredients
  budget: boolean; // costPhp <= budget
  time: boolean; // timeMinutes <= time limit
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
  checks: IdeaChecks;
};
