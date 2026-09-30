"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "@/components/arena/toast";
import { Button, Field, FormError } from "@/components/ui";
import { callApi } from "@/lib/api-client";

export default function ResetPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    setBusy(true);
    setError(null);
    const r = await callApi("/api/auth/reset", "POST", body);
    if (!r.ok) {
      setError(
        r.error ??
          "Das Passwort konnte nicht geändert werden. Bitte versuche es erneut.",
      );
      setBusy(false);
      return;
    }
    toast.success(
      "Passwort geändert. Melde dich jetzt mit dem neuen Passwort an.",
    );
    router.replace("/login");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
      <h1 className="font-display text-[34px] leading-none font-black uppercase">
        Neues Passwort
      </h1>
      <p className="text-sm text-muted">
        Den Reset-Code erzeugt der Admin eurer Runde für dich. Er gilt 24
        Stunden.
      </p>
      <Field
        label="E-Mail"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <Field
        label="Reset-Code"
        name="code"
        autoComplete="one-time-code"
        autoCapitalize="characters"
        spellCheck={false}
        required
      />
      <Field
        label="Neues Passwort"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        required
        hint="Mindestens 10 Zeichen."
      />
      <FormError>{error}</FormError>
      <Button type="submit" disabled={busy}>
        {busy ? (
          <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
        ) : null}
        Passwort ändern
      </Button>
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-muted underline-offset-4 hover:underline"
      >
        Zurück zur Anmeldung
      </Link>
    </form>
  );
}
