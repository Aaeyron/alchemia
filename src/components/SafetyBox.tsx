// High-contrast safety callout (yellow + near-black, hazard stripes). Styles: .safety-box in globals.css.

type SafetyBoxProps = {
  title?: string;
  children: React.ReactNode;
};

export function SafetyBox({ title = "Safety first!", children }: SafetyBoxProps) {
  return (
    <aside role="note" className="safety-box">
      <p className="mb-1 flex items-center gap-2 text-lg font-bold">
        <span aria-hidden="true">⚠️</span>
        {title}
      </p>
      <div className="text-base font-medium leading-relaxed">{children}</div>
    </aside>
  );
}
