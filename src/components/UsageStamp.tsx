import type { Idea } from "@/lib/types";

// "Uses 4 of 5 ingredients" as an ink stamp.
// - all used: blue ✓ stamp
// - some skipped, "use everything" off: blue stamp, just information
// - some skipped, "use everything" on: red ✗ stamp, like the other failing checks
export function UsageStamp({ idea, useEverything }: { idea: Idea; useEverything: boolean }) {
  const { usedCount, totalCount } = idea.usage;
  const text = `Uses ${usedCount} of ${totalCount} ingredients`;

  if (idea.checks.usesAll) return <span className="stamp -rotate-1 self-start">✓ {text}</span>;
  if (useEverything) return <span className="stamp stamp-fail self-start">✗ {text}</span>;
  return <span className="stamp -rotate-1 self-start">🧪 {text}</span>;
}
