"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { KeyRound, Loader2, FlaskConical } from "lucide-react";

const devLoginEnabled =
  process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true" &&
  process.env.NODE_ENV !== "production";

export default function LoginPage() {
  const [loading, setLoading] = useState<"google" | "passkey" | "dev" | null>(
    null,
  );

  async function handleGoogle() {
    setLoading("google");
    await signIn("google", { callbackUrl: "/board" });
  }

  async function handleDev() {
    setLoading("dev");
    await signIn("dev", { callbackUrl: "/board" });
  }

  async function handlePasskey() {
    setLoading("passkey");
    try {
      const optionsRes = await fetch("/api/passkey/authenticate/options", {
        method: "POST",
      });
      if (!optionsRes.ok)
        throw new Error("Optionen konnten nicht geladen werden");
      const options = await optionsRes.json();

      const authResponse = await startAuthentication(options);

      const result = await signIn("passkey", {
        response: JSON.stringify(authResponse),
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Passkey-Anmeldung fehlgeschlagen");
      }
      window.location.href = "/board";
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Passkey-Anmeldung fehlgeschlagen",
      );
      setLoading(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8 rounded-xl border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            MW
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">MyWorkgrid</h1>
          <p className="text-sm text-muted-foreground">
            Melde dich an, um auf dein Board zuzugreifen.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleGoogle}
            disabled={loading !== null}
            className="w-full"
            size="lg"
          >
            {loading === "google" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon className="mr-2 h-4 w-4" />
            )}
            Mit Google anmelden
          </Button>

          <Button
            onClick={handlePasskey}
            disabled={loading !== null}
            variant="outline"
            className="w-full"
            size="lg"
          >
            {loading === "passkey" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            Mit Passkey anmelden
          </Button>
        </div>

        {devLoginEnabled && (
          <>
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">nur Tests</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              onClick={handleDev}
              disabled={loading !== null}
              variant="secondary"
              className="w-full"
              size="lg"
            >
              {loading === "dev" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="mr-2 h-4 w-4" />
              )}
              Weiter ohne Login
            </Button>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Passkeys können nach dem ersten Login in den Einstellungen
          eingerichtet werden.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.97h5.35c-.23 1.4-1.62 4.1-5.35 4.1-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.93 3.4 14.7 2.4 12 2.4 6.92 2.4 2.8 6.52 2.8 11.6S6.92 20.8 12 20.8c5.3 0 8.8-3.72 8.8-8.96 0-.6-.07-1.06-.16-1.5z"
      />
    </svg>
  );
}
