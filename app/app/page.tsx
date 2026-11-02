import { StartRedirect } from "@/components/start-redirect";
import { Wordmark } from "@/components/wordmark";

/**
 * Startseite und start_url der PWA: statisch aus dem CDN und damit sofort da, auch wenn
 * die App-Funktion nach Leerlauf kalt ist (bis 2 s). Wortmarke unter Flutlicht, dann
 * weiter zu /team; ohne Session leitet die Middleware von dort auf /login. Immer dunkel:
 * Hell schnitte der Schräg-Verlauf der Anmeldung die Wortmarke, und das Startbild der
 * installierten App (background_color im Manifest) ist ohnehin dunkel.
 */
export default function StartPage() {
  return (
    <main
      data-theme="dark"
      className="login-bg relative flex min-h-dvh flex-col items-center justify-center overflow-hidden"
    >
      <div
        aria-hidden
        className="arena-anim absolute -top-[60px] left-[4%] h-[760px] w-[150px] origin-top animate-[arena-beam-l_3s_ease-in-out_infinite] bg-[linear-gradient(180deg,rgb(255_213_74/0.5),rgb(255_213_74/0)_75%)] [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)]"
      />
      <div
        aria-hidden
        className="arena-anim absolute -top-[60px] right-[4%] h-[760px] w-[150px] origin-top animate-[arena-beam-r_3s_ease-in-out_infinite] bg-[linear-gradient(180deg,rgb(255_244_214/0.4),rgb(255_244_214/0)_75%)] [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)]"
      />
      <div className="relative">
        <Wordmark />
        <p
          role="status"
          className="mt-6 flex items-end gap-1.5 text-xs font-bold tracking-[0.16em] text-hero-muted uppercase"
        >
          Lädt
          <span aria-hidden className="mb-[3px] flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="arena-anim h-1 w-1 animate-[arena-dot_1s_ease-in-out_infinite] bg-current"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        </p>
      </div>
      <StartRedirect />
    </main>
  );
}
