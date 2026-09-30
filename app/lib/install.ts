// „App installieren“ (Login und Optionen): welcher Weg passt zum Gerät?
// Android/Chrome liefert ein Installations-Ereignis, iOS nur den Weg über Safari.

export type InstallMode =
  /** Läuft schon als installierte App (Home-Bildschirm). */
  | "installed"
  /** Browser bietet eine Installation an (beforeinstallprompt, v. a. Android-Chrome). */
  | "prompt"
  /** iPhone/iPad: über Teilen → „Zum Home-Bildschirm“. */
  | "ios"
  /** Android ohne Angebot (anderer Browser oder noch nicht bereit): über das Browsermenü. */
  | "android"
  /** Desktop ohne Angebot: nichts anzeigen. */
  | "none";

export interface InstallEnv {
  userAgent: string;
  /** display-mode: standalone oder navigator.standalone (iOS). */
  standalone: boolean;
  hasPrompt: boolean;
  /** Für iPads, die sich als Mac ausgeben. */
  maxTouchPoints: number;
}

export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return (
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  );
}

export function installMode(env: InstallEnv): InstallMode {
  if (env.standalone) return "installed";
  if (env.hasPrompt) return "prompt";
  if (isIos(env.userAgent, env.maxTouchPoints)) return "ios";
  return /Android/.test(env.userAgent) ? "android" : "none";
}
