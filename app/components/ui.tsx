import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

/** Primär = Flutlicht (Natriumgelb), sekundär = Kreidelinie. */
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const look =
    variant === "primary"
      ? "bg-lampe text-nacht hover:brightness-105 disabled:opacity-60"
      : "border border-kreide/40 text-kreide hover:border-kreide disabled:opacity-60";
  return (
    <button
      className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 font-semibold transition ${look} ${className}`}
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
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-kreide"
      >
        {label}
      </label>
      <input
        id={inputId}
        className={`h-12 w-full rounded-xl border border-nacht-linie bg-nacht px-4 text-base text-kreide placeholder:text-kreide-matt/60 focus:border-lampe focus:outline-none ${className}`}
        {...props}
      />
      {hint ? <p className="text-xs text-kreide-matt">{hint}</p> : null}
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border-l-4 border-karte bg-karte/10 px-3 py-2 text-sm text-kreide"
    >
      {children}
    </p>
  );
}
