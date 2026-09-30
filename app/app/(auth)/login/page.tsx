// UI-Muster aus Workgrid app/(auth)/login/page.tsx, angepasst: E-Mail + Passwort statt Google/Passkey.
"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { Button, Field, FormError } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    if (!result || result.error) {
      setError(
        result?.status === 429
          ? "Zu viele Versuche. Bitte warte 15 Minuten."
          : "E-Mail oder Passwort stimmen nicht.",
      );
      setBusy(false);
      return;
    }
    router.replace("/team");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
      <h1 className="font-display text-[34px] leading-none font-black uppercase">
        Anmelden
      </h1>
      <Field
        label="E-Mail"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <Field
        label="Passwort"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormError>{error}</FormError>
      <Button type="submit" disabled={busy}>
        {busy ? (
          <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
        ) : null}
        Anmelden
      </Button>
      <div className="flex justify-between text-sm">
        <Link
          href="/registrieren"
          className="inline-flex min-h-11 items-center font-semibold text-text underline-offset-4 hover:underline"
        >
          Konto anlegen
        </Link>
        <Link
          href="/passwort-reset"
          className="inline-flex min-h-11 items-center font-semibold text-muted underline-offset-4 hover:underline"
        >
          Passwort vergessen?
        </Link>
      </div>
    </form>
  );
}
