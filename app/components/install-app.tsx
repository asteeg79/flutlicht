"use client";

import { Download, EllipsisVertical, Menu, Share } from "lucide-react";
import { toast } from "@/components/arena/toast";
import { useInstall } from "@/hooks/useInstall";

/**
 * „App installieren“ für Login und Optionen. Android/Chrome: Knopf, der den
 * Installationsdialog des Browsers öffnet. iPhone: Schritt-für-Schritt über Safari.
 * Läuft die App schon vom Home-Bildschirm, erscheint nichts.
 */
export function InstallApp({ variant }: { variant: "login" | "settings" }) {
  const { mode, install } = useInstall();
  if (mode === "installed" || mode === "none") return null;

  async function onInstall() {
    const outcome = await install();
    if (outcome === "accepted")
      toast("Flutlicht ist jetzt auf deinem Home-Bildschirm.");
  }

  const box =
    variant === "login"
      ? "mt-5 border-t border-line pt-4"
      : "bg-surface p-3.5 text-text";
  const step = "flex items-start gap-2.5 text-sm leading-snug";
  const num =
    "flex h-6 w-6 shrink-0 items-center justify-center bg-lampe font-display text-sm font-black text-nacht";
  const icon = "inline h-4 w-4 align-[-3px]";

  const body = (
    <div className={box}>
      <p className="font-display text-xl leading-tight font-black uppercase">
        Flutlicht als App
      </p>
      <p className="mt-1 text-[13px] text-muted">
        Auf den Home-Bildschirm legen: startet wie eine App, im Vollbild, und
        {mode === "ios"
          ? " nur so kommen auf dem iPhone Push-Nachrichten an."
          : " mit Push-Nachrichten."}
      </p>

      {mode === "prompt" ? (
        <button
          type="button"
          onClick={onInstall}
          className="slant mt-3 flex h-12 w-full items-center justify-center gap-2 bg-lampe font-display text-xl font-black text-nacht uppercase"
        >
          <Download aria-hidden className="h-5 w-5" strokeWidth={2.6} />
          App installieren
        </button>
      ) : mode === "ios" ? (
        <ol className="mt-3 flex flex-col gap-2">
          <li className={step}>
            <span className={num}>1</span>
            <span>
              In <b>Safari</b> unten auf das Menü{" "}
              <Menu aria-label="Menü" className={icon} strokeWidth={2.4} />{" "}
              tippen und <b>Teilen</b> wählen (ältere iPhones: direkt das
              Teilen-Symbol{" "}
              <Share aria-label="Teilen" className={icon} strokeWidth={2.4} />
              ).
            </span>
          </li>
          <li className={step}>
            <span className={num}>2</span>
            <span>
              <b>„Zum Home-Bildschirm“</b> wählen – falls nicht zu sehen, unter{" "}
              <b>„Mehr anzeigen“</b>.
            </span>
          </li>
          <li className={step}>
            <span className={num}>3</span>
            <span>
              <b>„Hinzufügen“</b> tippen und Flutlicht ab jetzt vom
              Home-Bildschirm öffnen.
            </span>
          </li>
        </ol>
      ) : (
        <p className={`${step} mt-3`}>
          <span className={num}>
            <EllipsisVertical
              aria-hidden
              className="h-4 w-4"
              strokeWidth={2.6}
            />
          </span>
          <span>
            Im Browsermenü <b>⋮</b> <b>„App installieren“</b> oder{" "}
            <b>„Zum Startbildschirm hinzufügen“</b> wählen.
          </span>
        </p>
      )}
    </div>
  );
  return (
    <section aria-label="App installieren" data-testid="install-app">
      {variant === "settings" ? (
        <h2 className="mb-2 font-display text-2xl font-black uppercase">App</h2>
      ) : null}
      {body}
    </section>
  );
}
