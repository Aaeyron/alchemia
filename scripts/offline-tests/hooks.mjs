// Module hooks for the offline tests (Node's own TypeScript support, no packages):
// - "@/lib/meta" -> src/lib/meta.ts (the same alias as tsconfig.json)
// - "./fakeFetch" -> ./fakeFetch.ts (imports without an extension, as TypeScript writes them)
// - "server-only" -> an empty stub (it only matters for the Next.js build)
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: new URL("./server-only-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  const base = specifier.startsWith("@/")
    ? path.join(SRC, specifier.slice(2))
    : specifier.startsWith(".") && context.parentURL && !path.extname(specifier)
      ? fileURLToPath(new URL(specifier, context.parentURL))
      : null;
  if (base) {
    for (const file of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
