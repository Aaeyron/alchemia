import type { RefObject } from "react";
import { Mascot } from "@/components/Mascot";

// One button in the bottom action bar. `reason` is shown when the button is disabled.
export type StepAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  reason?: string;
};

type StepShellProps = {
  emoji: string;
  title: string;
  instruction: string; // one friendly line under the heading
  say: string; // what the mascot says on this step
  bubbling: boolean; // something is running: the mascot bobs
  headingRef: RefObject<HTMLHeadingElement | null>; // the page moves focus here on every step change
  back?: StepAction;
  next?: StepAction;
  nextColor?: string; // background class of the main button, e.g. "bg-pink"
  children: React.ReactNode;
};

const disabledClass = "disabled:pointer-events-none disabled:opacity-50";

// The frame around every step: mascot + speech bubble, heading, content, and the action bar.
export function StepShell({
  emoji,
  title,
  instruction,
  say,
  bubbling,
  headingRef,
  back,
  next,
  nextColor = "bg-sunny",
  children,
}: StepShellProps) {
  // The reason under the bar explains why the main action (or else the back button) can't be used.
  const reason = next?.disabled ? next.reason : back?.disabled ? back.reason : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <Mascot size={80} bubbling={bubbling} />
        </div>
        {/* Speech bubble, with a little tail pointing at the mascot */}
        <p className="sticker relative bg-white px-4 py-2 text-lg font-semibold">
          <span
            aria-hidden="true"
            className="absolute top-1/2 -left-[11px] h-4 w-4 -translate-y-1/2 rotate-45 border-b-[3px] border-l-[3px] border-ink bg-white"
          />
          {say}
        </p>
      </div>

      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="flex items-center gap-2 text-3xl font-bold focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-sky"
        >
          <span aria-hidden="true">{emoji}</span>
          {title}
        </h2>
        <p className="mt-1 text-lg">{instruction}</p>
      </div>

      {children}

      {(back || next) && (
        // Sticks to the bottom of the screen on phones (above the home bar); sits under the content on wider screens.
        <div className="sticky bottom-0 z-20 -mx-4 px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:px-0 sm:pb-0">
          <div className="sticker flex flex-col gap-2 bg-white p-3">
            <div className="flex gap-3">
              {back && (
                <button
                  type="button"
                  onClick={back.onClick}
                  disabled={back.disabled}
                  className={`sticker pressable min-h-12 bg-white px-4 py-2 text-lg font-semibold ${disabledClass}`}
                >
                  {back.label}
                </button>
              )}
              {next && (
                <button
                  type="button"
                  onClick={next.onClick}
                  disabled={next.disabled}
                  aria-describedby={next.disabled && next.reason ? "step-reason" : undefined}
                  className={`sticker pressable min-h-14 flex-1 px-4 py-2 text-xl font-bold ${nextColor} ${disabledClass}`}
                >
                  {next.label}
                </button>
              )}
            </div>
            {reason && (
              <p id="step-reason" className="text-center text-base font-medium">
                {reason}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
