import { Button } from "@/components/Button";

type PictureErrorProps = {
  message: string; // friendly message from the server
  busy: boolean; // a picture or tweak is being made
  onRetry: () => void;
};

// A small "couldn't paint" note for the picture area only: the idea, recipe and steps stay on screen.
export function PictureError({ message, busy, onRetry }: PictureErrorProps) {
  return (
    <div role="alert" className="empty-state flex flex-col items-center gap-2 bg-pink-soft text-center">
      <p>
        <span aria-hidden="true">🎨 </span>
        {message}
      </p>
      <Button onClick={onRetry} disabled={busy}>
        🎨 Try painting again
      </Button>
    </div>
  );
}
