// The "Oops!" message box, with an optional "Try again" button.

type ErrorBoxProps = {
  message: string;
  onRetry?: () => void;
};

export function ErrorBox({ message, onRetry }: ErrorBoxProps) {
  return (
    <div role="alert" className="sticker flex flex-col gap-3 bg-pink-soft p-4 text-base">
      <p>
        <strong>Oops! </strong>
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="sticker pressable min-h-12 self-start bg-white px-5 py-2 font-semibold"
        >
          🔁 Try again
        </button>
      )}
    </div>
  );
}
