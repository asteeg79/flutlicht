"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { Button, Field, FormError } from "@/components/ui";
import { callApi } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    setBusy(true);
    setError(null);
    const r = await callApi("/api/auth/register", "POST", body);
    if (!r.ok) {
      setError(
        r.error ??
          "Das Konto konnte nicht angelegt werden. Bitte versuche es erneut.",
      );
      setBusy(false);
      return;
    }
    await signIn("credentials", {
      email: body.email,
      password: body.password,
      redirect: false,
    });
    router.replace("/team");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
      <h1 className="font-display text-[34px] leading-none font-black uppercase">
        Konto anlegen
      </h1>
      <Field
        label="Einladungscode"
        name="inviteCode"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        hint="8 Zeichen, bekommst du vom Admin eurer Runde."
      />
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
        autoComplete="new-password"
        minLength={10}
        required
        hint="Mindestens 10 Zeichen."
      />
      <Field
        label="Anzeigename"
        name="displayName"
        autoComplete="nickname"
        maxLength={40}
        required
      />
      <Field label="Teamname" name="teamName" maxLength={40} required />
      <FormError>{error}</FormError>
      <Button type="submit" disabled={busy}>
        {busy ? (
          <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
        ) : null}
        Konto anlegen
      </Button>
      <p className="text-sm text-muted">
        Schon dabei?{" "}
        <Link
          href="/login"
          className="text-text underline-offset-4 hover:underline"
        >
          Anmelden
        </Link>
      </p>
    </form>
  );
}
