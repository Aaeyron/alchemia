import type { RefObject } from "react";
import { Button } from "@/components/Button";
import { Squiggle } from "@/components/Doodles";
import { SpeechBubble } from "@/components/SpeechBubble";

// One button in the bottom action bar. `reason` is shown when the button is disabled.
// `short` is shown instead of `label` on phones, so the bar stays one line; `label` stays its name.
export type StepAction = {
  label: string;
  short?: string;
  onClick: () => void;
  disabled?: boolean;
  reason?: string;
};

function ActionLabel({ action }: { action: StepAction }) {
  if (!action.short) return action.label;
  return (
    <>
      <span className="sm:hidden">{action.short}</span>
      <span className="hidden sm:inline">{action.label}</span>
    </>
  );
}

type StepShellProps = {
  emoji: string;
  title: string;
  instruction: string; // one friendly line under the heading
  say: string; // what the mascot says right now (from bubbleLines.ts)
  bubbling: boolean; // something is running: the mascot bobs
  cheer?: boolean; // the mascot jumps for joy once (step 5)
  headingRef: RefObject<HTMLHeadingElement | null>; // the page moves focus here on every step change
  back?: StepAction;
  next?: StepAction;
  children: React.ReactNode;
};

// The frame around every step: mascot + speech bubble, heading, content, and the action bar.
// Every step has the same order and spacing: mascot, heading, instruction, panels, action bar.
export function StepShell({
  emoji,
  title,
  instruction,
  say,
  bubbling,
  cheer = false,
  headingRef,
  back,
  next,
  children,
}: StepShellProps) {
  // The reason under the bar explains why the main action (or else the back button) can't be used.
  const reason = next?.disabled ? next.reason : back?.disabled ? back.reason : undefined;

  return (
    <div className="flex flex-col gap-section">
      <SpeechBubble line={say} bubbling={bubbling} cheer={cheer} />

      <div>
        <h2 ref={headingRef} tabIndex={-1} className="h-step flex items-center gap-2">
          <span aria-hidden="true" className="text-3xl">
            {emoji}
          </span>
          {title}
        </h2>
        <Squiggle className="mt-1 h-3 w-28" />
        <p className="mt-2 text-lg">{instruction}</p>
      </div>

      {children}

      {(back || next) && (
        // Sticks to the bottom of the screen on phones (above the home bar); sits under the content on wider screens.
        <div className="sticky bottom-0 z-20 -mx-4 px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:px-0 sm:pb-0">
          <div className="sticker flex flex-col gap-2 bg-white p-3">
            <div className="flex gap-3">
              {back && (
                <Button
                  onClick={back.onClick}
                  disabled={back.disabled}
                  aria-label={back.short ? back.label : undefined}
                  className="min-h-12 whitespace-nowrap"
                >
                  <ActionLabel action={back} />
                </Button>
              )}
              {next && (
                <Button
                  variant="primary"
                  size="large"
                  onClick={next.onClick}
                  disabled={next.disabled}
                  aria-label={next.short ? next.label : undefined}
                  aria-describedby={next.disabled && next.reason ? "step-reason" : undefined}
                  className="flex-1 whitespace-nowrap py-2"
                >
                  <ActionLabel action={next} />
                </Button>
              )}
            </div>
            {reason && (
              <p id="step-reason" className="hint text-center">
                {reason}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
