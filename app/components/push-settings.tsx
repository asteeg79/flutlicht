"use client";

import type { ManagerDoc } from "@fm/core";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/arena/toast";
import { useInstall } from "@/hooks/useInstall";
import { usePush } from "@/hooks/usePush";
import { callApi } from "@/lib/api-client";

type Prefs = NonNullable<ManagerDoc["push"]>["prefs"];

const PREF_LABELS: { key: keyof Prefs; label: string; hint: string }[] = [
  {
    key: "reminder",
    label: "Erinnerung vor dem Anpfiff",
    hint: "24 und 3 Stunden, bevor die ersten Spieler fixiert werden – wenn deiner Aufstellung etwas fehlt",
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
  const iosHint = useInstall().mode === "ios";

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
      className="bg-surface px-3.5 pt-1 pb-3.5"
    >
      <div className="flex items-center justify-between gap-3.5 py-3">
        <div>
          <h3 className="font-display text-[22px] leading-tight font-black">
            Push auf diesem Gerät
          </h3>
          <p className="mt-0.5 text-xs font-medium text-muted">
            {state === "unsupported"
              ? "Dieser Browser kann keine Push-Benachrichtigungen empfangen."
              : state === "denied"
                ? "Im Browser blockiert. Erlaube Benachrichtigungen in den Website-Einstellungen."
                : "Erinnerungen, Tagesfazit und Endergebnis."}
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
        <p className="mb-2 border-l-4 border-lampe bg-bg px-3 py-2 text-sm">
          Auf dem iPhone kommen Benachrichtigungen nur an, wenn Flutlicht als
          App auf dem Home-Bildschirm liegt – so geht’s: siehe „App“ oben.
        </p>
      ) : null}

      {subscribed ? (
        <>
          <ul>
            {PREF_LABELS.map(({ key, label, hint }) => (
              <li
                key={key}
                className="flex items-center justify-between gap-3.5 border-t border-line py-3"
              >
                <div>
                  <p className="text-[15px] font-semibold">{label}</p>
                  <p className="mt-0.5 text-xs font-medium text-muted">
                    {hint}
                  </p>
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
            className="mt-1 h-11 border-2 border-line px-3.5 font-display text-base font-black uppercase disabled:opacity-60"
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
      className={`relative h-[30px] w-[52px] shrink-0 rounded-full transition after:absolute after:-inset-2 after:content-[""] disabled:opacity-50 ${checked ? "bg-lampe" : "bg-line"}`}
    >
      <span
        aria-hidden
        className={`absolute top-1 left-1 h-[22px] w-[22px] rounded-full bg-nacht transition-transform duration-150 ${checked ? "translate-x-[22px]" : ""}`}
      />
    </button>
  );
}
