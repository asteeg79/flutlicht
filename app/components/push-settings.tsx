"use client";

import type { ManagerDoc } from "@fm/core";
import { LoaderCircle } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { usePush } from "@/hooks/usePush";
import { callApi } from "@/lib/api-client";

type Prefs = NonNullable<ManagerDoc["push"]>["prefs"];

const PREF_LABELS: { key: keyof Prefs; label: string; hint: string }[] = [
  {
    key: "reminder",
    label: "Erinnerung vor der Sperre",
    hint: "24 und 3 Stunden vorher, wenn deiner Aufstellung etwas fehlt",
  },
  {
    key: "daily",
    label: "Tagesfazit",
    hint: "Abends deine Punkte des Tages und dein Platz im Spieltag",
  },
  {
    key: "final",
    label: "Endergebnis",
    hint: "Wenn ein Spieltag final ist: Punkte, Platz und Sieger",
  },
];

/** Push je Typ und Test-Push (KONZEPT 8.1, 8.5); iPhone nur als installierte App. */
export function PushSettings({ initialPrefs }: { initialPrefs: Prefs | null }) {
  const { state, subscribed, loading, subscribe, unsubscribe } = usePush();
  const [prefs, setPrefs] = useState<Prefs>(
    initialPrefs ?? { reminder: true, daily: true, final: true },
  );
  const [busy, setBusy] = useState(false);
  const iosHint = useIosInstallHint();

  async function savePrefs(next: Prefs) {
    setPrefs(next);
    const r = await callApi("/api/push/prefs", "PUT", next);
    if (!r.ok) {
      setPrefs(prefs);
      toast.error(r.error ?? "Speichern hat nicht geklappt.");
    }
  }

  async function sendTest() {
    setBusy(true);
    const r = await callApi("/api/push/test", "POST");
    setBusy(false);
    if (r.ok) toast.success("Test-Push ist unterwegs.");
    else toast.error(r.error ?? "Der Test-Push hat nicht geklappt.");
  }

  return (
    <section
      aria-label="Benachrichtigungen"
      className="mb-8 rounded-xl border border-line bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Push-Benachrichtigungen</h2>
          <p className="text-sm text-muted">
            {state === "unsupported"
              ? "Dieser Browser kann keine Push-Benachrichtigungen empfangen."
              : state === "denied"
                ? "Im Browser blockiert. Erlaube Benachrichtigungen in den Website-Einstellungen."
                : "Auf diesem Gerät."}
          </p>
        </div>
        {loading ? (
          <LoaderCircle
            aria-hidden
            className="h-4 w-4 animate-spin text-muted"
          />
        ) : null}
        <Switch
          label="Push-Benachrichtigungen"
          checked={subscribed}
          disabled={loading || state === "unsupported" || state === "denied"}
          onChange={(on) => void (on ? subscribe() : unsubscribe())}
        />
      </div>

      {iosHint ? (
        <p className="mt-3 rounded-lg bg-bg px-3 py-2 text-sm">
          Auf dem iPhone kommen Benachrichtigungen nur an, wenn du die App
          installierst: in Safari auf{" "}
          <span className="font-semibold">Teilen</span> tippen, dann{" "}
          <span className="font-semibold">„Zum Home-Bildschirm“</span>, und die
          App von dort öffnen.
        </p>
      ) : null}

      {subscribed ? (
        <>
          <ul className="mt-4 space-y-3 border-t border-line pt-4">
            {PREF_LABELS.map(({ key, label, hint }) => (
              <li key={key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted">{hint}</p>
                </div>
                <Switch
                  label={label}
                  checked={prefs[key]}
                  onChange={(on) => void savePrefs({ ...prefs, [key]: on })}
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={sendTest}
            disabled={busy}
            className="mt-4 h-10 rounded-lg border border-text/40 px-4 text-sm font-semibold disabled:opacity-60"
          >
            Test-Push senden
          </button>
        </>
      ) : null}
    </section>
  );
}

function Switch({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? "bg-lampe" : "bg-line"}`}
    >
      <span
        aria-hidden
        className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-bg transition-transform ${checked ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

/** iPhone/iPad in Safari, aber nicht als installierte App (navigator.standalone / display-mode). */
function useIosInstallHint(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone =
        (navigator as Navigator & { standalone?: boolean }).standalone ===
          true || window.matchMedia("(display-mode: standalone)").matches;
      return ios && !standalone;
    },
    () => false,
  );
}
