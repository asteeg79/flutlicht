import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

/** Primär = Flutlicht (Natriumgelb, schräg, mit Glow), sekundär = Kreidelinie. */
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const look =
    variant === "primary"
      ? "slant h-[54px] bg-lampe text-2xl tracking-[0.04em] text-nacht shadow-[0_0_30px_rgb(255_213_74/0.4)]"
      : "h-12 border-2 border-text text-xl";
  return (
    <button
      className={`inline-flex w-full items-center justify-center gap-2 px-5 font-display font-black uppercase transition disabled:opacity-60 ${look} ${className}`}
      {...props}
    />
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
};

export function Field({
  label,
  hint,
  id,
  className = "",
  ...props
}: FieldProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-semibold">
        {label}
      </label>
      <input
        id={inputId}
        className={`h-12 w-full border-2 border-line bg-bg px-3.5 text-base font-medium text-text placeholder:text-muted/60 focus:border-lampe focus:outline-none ${className}`}
        {...props}
      />
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="border-l-4 border-karte bg-karte/10 px-3 py-2 text-sm text-text"
    >
      {children}
    </p>
  );
}
