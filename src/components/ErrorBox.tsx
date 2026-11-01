import { Button } from "@/components/Button";

// The "Oops!" message box (used for every error), with an optional "Try again" button.

type ErrorBoxProps = {
  message: string;
  onRetry?: () => void;
};

export function ErrorBox({ message, onRetry }: ErrorBoxProps) {
  return (
    <div role="alert" className="panel bg-pink-soft text-base">
      <p>
        <strong>Oops! </strong>
        {message}
      </p>
      {onRetry && (
        <Button onClick={onRetry} className="self-start">
          🔁 Try again
        </Button>
      )}
    </div>
  );
}
