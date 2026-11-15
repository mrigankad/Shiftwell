import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-cta text-on-cta hover:opacity-90",
  accent: "bg-action text-on-action hover:brightness-110",
  secondary: "border border-line bg-card text-ink hover:bg-surface",
  ghost: "text-body hover:bg-surface hover:text-ink",
  danger: "border border-line bg-card text-fail hover:bg-fail-soft",
};
const SIZE: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-meta",
  md: "min-h-10 px-3.5 py-2 text-sm",
};

/** Class string for anything that should look like a button. */
export function buttonCls(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra = ""): string {
  return `inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-bold disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT[variant]} ${SIZE[size]} ${extra}`;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize };

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "secondary", size = "md", className = "", type = "button", ...rest }, ref) {
  return <button ref={ref} type={type} className={buttonCls(variant, size, className)} {...rest} />;
});

type IconProps = ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string; tone?: "default" | "danger" };

/** Square icon-only button. Always pass an aria-label. */
export const IconButton = forwardRef<HTMLButtonElement, IconProps>(function IconButton({ className = "", tone = "default", type = "button", ...rest }, ref) {
  return (
    <button ref={ref} type={type}
      className={`flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted hover:bg-surface disabled:cursor-not-allowed disabled:opacity-30 ${tone === "danger" ? "hover:text-fail" : "hover:text-ink"} ${className}`}
      {...rest} />
  );
});
