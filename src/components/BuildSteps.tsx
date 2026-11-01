// The numbered build steps of an idea, written down the ruled notebook lines.
export function BuildSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-thick border-ink bg-sunny text-lg font-bold"
          >
            {i + 1}
          </span>
          <span className="pt-1 text-base leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  );
}
