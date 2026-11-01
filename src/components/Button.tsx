import type { ButtonHTMLAttributes } from "react";

// The one button style of the app. Looks live in globals.css (.btn and friends):
// - primary: the main thing to do (sunny yellow)
// - secondary: everything else (white)
// - ghost: small, quiet links like "Back to previous version"
// - danger: stop or remove (pink)
// Sizes: normal (44px tall), large (56px, the main action), icon (a small round ✕).

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "normal" | "large" | "icon";

// The same classes, for things that must be a <label> (file pickers) but look like a button.
export function buttonClasses(variant: ButtonVariant = "secondary", size: ButtonSize = "normal"): string {
  const sizeClass = size === "large" ? "btn-large" : size === "icon" ? "btn-icon" : "";
  return `btn btn-${variant} ${sizeClass}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = "secondary", size = "normal", type = "button", className = "", ...rest }: ButtonProps) {
  return <button type={type} className={`${buttonClasses(variant, size)} ${className}`} {...rest} />;
}
